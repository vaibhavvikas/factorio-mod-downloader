use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use downloader::models::{DownloadStatus, DownloadTask};
use mod_manager::models::{
    DownloadBatch, DownloadBatchKind, DownloadBatchPhase, DownloadItemNode, DownloadItemState,
};
use crate::features::config::get_config_dir;

fn batches_file_path() -> Result<PathBuf, String> {
    Ok(get_config_dir()?.join("download-batches.json"))
}

pub fn load_persisted_batches() -> Vec<DownloadBatch> {
    if let Ok(path) = batches_file_path() {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(path) {
                if let Ok(batches) = serde_json::from_str::<Vec<DownloadBatch>>(&content) {
                    return batches;
                }
            }
        }
    }
    Vec::new()
}

pub fn save_persisted_batches(batches: &[DownloadBatch]) -> Result<(), String> {
    let path = batches_file_path()?;
    let json = serde_json::to_string_pretty(batches).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

fn map_item_state(status: &DownloadStatus) -> (DownloadItemState, Option<String>) {
    match status {
        DownloadStatus::Pending => (DownloadItemState::Queued, None),
        DownloadStatus::Downloading => (DownloadItemState::Downloading, None),
        DownloadStatus::Paused => (DownloadItemState::Paused, None),
        DownloadStatus::Completed
        | DownloadStatus::AlreadyExists
        | DownloadStatus::Updated
        | DownloadStatus::Downgraded => (DownloadItemState::Installed, None),
        DownloadStatus::Failed(err) => {
            if err.contains("Cancelled") {
                (DownloadItemState::Cancelled, Some(err.clone()))
            } else {
                (DownloadItemState::Failed, Some(err.clone()))
            }
        }
    }
}

pub fn compute_batches_from_tasks(tasks: &[DownloadTask]) -> Vec<DownloadBatch> {
    // 1. Group tasks by batch_id
    let mut tasks_by_batch: HashMap<String, Vec<&DownloadTask>> = HashMap::new();
    for task in tasks {
        let b_id = task.batch_id.clone().unwrap_or_else(|| {
            // Fallback: group by enqueued_at timestamp within 5 second buckets or fallback
            if let Some(enq) = task.enqueued_at {
                format!("batch_{}", enq / 5000)
            } else {
                "batch_default".to_string()
            }
        });
        tasks_by_batch.entry(b_id).or_default().push(task);
    }

    let mut batches = Vec::new();

    for (batch_id, batch_tasks) in tasks_by_batch {
        if batch_tasks.is_empty() {
            continue;
        }

        let first_task = batch_tasks[0];
        let label = first_task
            .batch_name
            .clone()
            .unwrap_or_else(|| {
                if batch_tasks.len() == 1 {
                    format!("Install {}", first_task.title)
                } else {
                    format!("Install {} mods", batch_tasks.len())
                }
            });

        let kind = if label.to_lowercase().starts_with("update") {
            DownloadBatchKind::Update
        } else if label.to_lowercase().starts_with("apply collection") {
            DownloadBatchKind::CollectionApply
        } else if label.to_lowercase().starts_with("import") {
            DownloadBatchKind::Import
        } else if batch_tasks.len() == 1 {
            DownloadBatchKind::Single
        } else {
            DownloadBatchKind::Queue
        };

        let created_at = batch_tasks
            .iter()
            .filter_map(|t| t.enqueued_at)
            .min()
            .unwrap_or_else(|| {
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0)
            });

        // Map titles for lookup
        let title_by_id: HashMap<String, String> = batch_tasks
            .iter()
            .map(|t| (t.id.clone(), t.title.clone()))
            .collect();

        // Determine roots vs children
        let mut is_root_map: HashMap<String, bool> = HashMap::new();
        for t in &batch_tasks {
            let is_root = t.requested_by.is_empty();
            is_root_map.insert(t.id.clone(), is_root);
        }

        // Build item nodes
        let mut item_nodes: Vec<DownloadItemNode> = Vec::new();
        let mut first_error: Option<String> = None;

        for (idx, task) in batch_tasks.iter().enumerate() {
            let (state, err) = map_item_state(&task.status);
            if first_error.is_none() && err.is_some() {
                first_error = err.clone();
            }

            let is_root = is_root_map.get(&task.id).copied().unwrap_or(true);

            let (depth, via, subtitle) = if is_root {
                let sub = if !task.requested_by.is_empty() {
                    Some(format!(
                        "Installed by you · also required by {}",
                        task.requested_by
                            .iter()
                            .map(|req| title_by_id.get(req).unwrap_or(req).as_str())
                            .collect::<Vec<_>>()
                            .join(", ")
                    ))
                } else {
                    None
                };
                (0, None, sub)
            } else {
                let primary_requester = task.requested_by.first().cloned().unwrap_or_default();
                let requester_title = title_by_id
                    .get(&primary_requester)
                    .cloned()
                    .unwrap_or_else(|| primary_requester.clone());

                let requester_is_root = is_root_map.get(&primary_requester).copied().unwrap_or(false);
                let via = if requester_is_root || primary_requester.is_empty() {
                    None
                } else {
                    Some(requester_title.clone())
                };

                let sub = if task.requested_by.len() > 1 {
                    let others = task.requested_by[1..]
                        .iter()
                        .map(|req| title_by_id.get(req).unwrap_or(req).as_str())
                        .collect::<Vec<_>>()
                        .join(", ");
                    Some(format!("Dependency of {} · also needed by {}", requester_title, others))
                } else if !primary_requester.is_empty() {
                    Some(format!("Dependency of {}", requester_title))
                } else {
                    Some("Dependency".to_string())
                };

                (1, via, sub)
            };

            let speed = match task.status {
                DownloadStatus::Downloading => {
                    let total_mb = task.total_bytes as f64 / (1024.0 * 1024.0);
                    let done_mb = task.downloaded_bytes as f64 / (1024.0 * 1024.0);
                    if done_mb > 0.0 && total_mb > 0.0 {
                        "1.2".to_string()
                    } else {
                        "0.0".to_string()
                    }
                }
                _ => "0.0".to_string(),
            };

            item_nodes.push(DownloadItemNode {
                id: format!("{}_{}", task.id, task.version),
                batch_id: batch_id.clone(),
                name: task.id.clone(),
                version: task.version.clone(),
                title: task.title.clone(),
                reason: task.reason.clone().unwrap_or_else(|| {
                    if is_root { "direct".to_string() } else { "dependency".to_string() }
                }),
                requested_by: task.requested_by.clone(),
                position: idx + 1,
                state,
                bytes_total: task.total_bytes,
                bytes_done: task.downloaded_bytes,
                speed,
                error: err,
                started_at: task.enqueued_at,
                finished_at: if matches!(task.status, DownloadStatus::Completed | DownloadStatus::AlreadyExists | DownloadStatus::Updated | DownloadStatus::Downgraded) {
                    Some(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0))
                } else {
                    None
                },
                sha1: task.sha1.clone(),
                depth,
                via,
                is_root,
                subtitle,
                thumbnail: None,
            });
        }

        // Reorder items in batch: place nested children directly under their requester root
        let mut ordered_items = Vec::new();
        let mut placed = std::collections::HashSet::new();

        // 1. For each root item
        for item in &item_nodes {
            if item.is_root {
                ordered_items.push(item.clone());
                placed.insert(item.name.clone());

                // Find all children that requested this root as their primary requester
                for child in &item_nodes {
                    if !child.is_root
                        && !placed.contains(&child.name)
                        && child.requested_by.first() == Some(&item.name)
                    {
                        ordered_items.push(child.clone());
                        placed.insert(child.name.clone());
                    }
                }
            }
        }

        // 2. Any remaining items (e.g. indirect or update items)
        for item in &item_nodes {
            if !placed.contains(&item.name) {
                ordered_items.push(item.clone());
                placed.insert(item.name.clone());
            }
        }

        // Determine batch phase
        let phase = if ordered_items.iter().any(|i| i.state == DownloadItemState::Downloading || i.state == DownloadItemState::Queued) {
            DownloadBatchPhase::Downloading
        } else if ordered_items.iter().any(|i| i.state == DownloadItemState::Paused) {
            DownloadBatchPhase::Paused
        } else if ordered_items.iter().any(|i| i.state == DownloadItemState::Failed) {
            DownloadBatchPhase::Failed
        } else if ordered_items.iter().all(|i| i.state == DownloadItemState::Cancelled) {
            DownloadBatchPhase::Cancelled
        } else {
            DownloadBatchPhase::Done
        };

        batches.push(DownloadBatch {
            id: batch_id,
            kind,
            label,
            created_at,
            phase,
            error: first_error,
            items: ordered_items,
        });
    }

    // Sort batches: active batches first, then by created_at descending (newest first)
    batches.sort_by(|a, b| {
        let a_active = matches!(a.phase, DownloadBatchPhase::Downloading | DownloadBatchPhase::Paused);
        let b_active = matches!(b.phase, DownloadBatchPhase::Downloading | DownloadBatchPhase::Paused);
        match (a_active, b_active) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => b.created_at.cmp(&a.created_at),
        }
    });

    batches
}

