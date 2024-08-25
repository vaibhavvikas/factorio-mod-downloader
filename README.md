# factorio-mod-downloader

Factorio mod downloader, used [re146.dev]{https://re146.dev/factorio/mods} to recursively download a mod and its all required depndedncies. Its really helpful if you want to download a modpack as a modpack contains various different recommended mods, that if you want to download separately will take you a lot of clicks and headache.

If you love the game please buy it and support the developers. I am a big fan of the game.

### How to run
This code is built using python so make sure you have python installed. You can use official Python website to download any version > 3.10

1. Open main.py, and replace the mod_url line number 13 with the factorio 2 official mod url of the mod you want to download. for e.g. you want to download Krastorio 2, the mod_url will be exactly like this `mod_url = 'https://mods.factorio.com/mod/Krastorio2'`, dont forget to add inverted commas.
2. Run this command in cmd or terminal. `pip install -r requirements.txt` or `pip3 install -r requirements.txt` (Windows uses pip, while mac/linux uses pip3). It will install all dependencies, required to run this code.
2. Finally run the script using `python main.py` or `python3 main.py` (Windows uses python while mac/linux uses python3)
3. All the mods and its dependencies will be downloaded and saved in a new mods folder

### Note
I have not included optional dependencies, as its a stupid idea, since a lots of mods, even they don't need something have optional dependencies mentioned. So it will probbaly take forever to finish downloading. It can be implemented although. Not a big task.

Feel free to reach out to me if you need soem help.