use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Dependencies {
    pub required: Vec<Dependency>,
    pub recommended: Vec<Dependency>,
    pub optional: Vec<Dependency>,
    pub incompatible: Vec<Dependency>,
}

// TODO: Update to idomatic Option version and ineq to use Operator type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dependency {
    pub id: String,
    pub ineq: String,
    pub version: String,
}
