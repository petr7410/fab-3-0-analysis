# FaB 3-0 Draft Analysis

This project analyzes 3-0 decklists posted on the Rantaways Podcast Discord server and uses draft files from the same Discord server.

All data is available here thanks to GitHub [HERE](https://petr7410.github.io/fab-3-0-analysis) via GitHub Pages.

## Draft files

If you are here to test some older drafts, draft files starting from EVO are available in this repo.

You can access them at [_draft_data](https://github.com/petr7410/fab-3-0-analysis/_draft_data) in the folder of the set you are interested in (the newest version of the draft file should be the closest to the in-person draft experience) or in the _OTHER folder.

If you have a draft file for a set that is not available and would like it to be included in this public repo, please share it, and I will be more than happy to include it.

## How to Run Locally

### Required Python libraries to run locally:
- **pandas**  
- **scipy**  

### Run locally
Note: This repository contains all necessary data to run it without modifying anything. So you can test outputs before diving deeper into the init.json logic.
1. Clone or download main branch of this repository.
2. Navigate to the root folder of this project and run `python run_analysis.py` (use --latest or specify a set (--set OMN) if you don't want to generate data for all sets).
3. Run an HTTP server of your choice (`python -m http.server`) inside the root folder of this project and access generated data at `http://localhost:8000/docs/index.html`

But if you are only planning to do all of this, then you can simply visit the [GitHub Pages](https://petr7410.github.io/fab-3-0-analysis) of this project.

You can also use your own data:
1. Go to config/settings.json
2. Create your own SET, and fill in all necessary fields (you need decks (with included timestamp) and a draft file; filling the rest should be simple)
3. Navigate to the root folder of this project and run `python run_analysis.py --set SET`
4. Run an HTTP server of your choice (`python -m http.server`) inside the root folder of this project and access generated data at `http://localhost:8000/docs/index.html`, which will also include your SET

## File Structure

### `/_draft_data`
- Folder with draft files and decks by set and `all_cards.csv` from the [Flesh and Blood Cards](https://github.com/the-fab-cube/flesh-and-blood-cards) repo.
- This folder contains all data needed to run the analysis.

### `/config`
- `settings.json`: The central config file that contains core information about _draft_data to allow correct processing.

### `/data`
- Generated data files.

### `/src`
- `/analysis`: responsible for generating all the files available in the data folder.
- `/data_gathering`: responsible for processing the raw data into an easier-to-use format.
- `/data_processing`: responsible for adding attributes to data necessary for analysis and additional processing of data.
- `/utils`: Helper functions.

### `/docs`
- Used to properly load and show processed data on a web page.

## Configuration: `settings.json`

This file should be more or less self-explanatory, but if you write your own SET, be sure that your first draft file has a date before the timestamp of your oldest deck.

## About this project
This is the second version of this project. I started working on the first version in the middle of 2024, during the Part the Mistveil set (which is still my favorite set for drafting).

The first version was meant to present data in Markdown files so it could be simply opened on GitHub. Then I learned that custom Markdown styles are not supported on GitHub and that GitHub Pages exists. So I reworked the entire repository to use GitHub Pages for presenting data.

It comes as no surprise that the resulting code was a big mess. It wasn't optimal to begin with, but these changes did not help. I did some refactoring, but the project was still hard to manage.

And then came SUP and PEN, and online drafting pretty much died for one year. During this time, I realized that I should start working on the rework. During this time I got much more experience in JS (when I started working on this project I was pretty much a beginner) and there were also significant improvements in AI. So, for almost a year ... I pretty much procrastinated and put much less work into this project than it deserves.

Sure, I used AI and it helped me significantly. Still, I'm not a huge fan of the agentic approach, so I always force myself to review all files modified by AI. And it seems that my old project was such a mess that AI wasn't even able to refactor it properly. "What do you mean each time a function is used, there is a comment that states 'this function works exactly the opposite way the name implies it works'?" That sounds like something I would do, but what about changing the name or reversing the output ...

Well, I still managed to put in some work, but this project wasn't ready when OMN was released, so the plan was to release it before US Nationals. Well, that also failed, but at least I managed to release it during them.

But finally I was able to release this project and I'm quite happy with the results. This project is by no means finished, and I'm planning to continue working on it. I finally have a decent framework that I can start building on, and I would definitely like to include some pretty visualizations.

Well, if you read this far, then kudos to you, as I'm surprised that someone was so interested in this project that they reached this part of the README.

I hope that you find this project useful and that it will help you win some games, or maybe even give you some kind of inspiration.

## Future plans
- Consider using Vite build to improve page loading and resolve possible problems with caching.
- Look into the logic that is used to determine which draft file was used for a deck and improve it.
- Include a page with visualizations (take inspiration from the old project; clustering of shared cards).
- Python code is still messy, and it would definitely deserve some more refactoring.
- Use different versioning for draft files, or at least place somewhere their original names.

## Acknowledgements

Special thanks to the following projects and communities whose resources made this work possible:

- **[Flesh and Blood Cards](https://github.com/the-fab-cube/flesh-and-blood-cards)** - For providing detailed and structured Flesh and Blood card data.
- **[Rantaways Podcast](https://discord.com/invite/EcKkyJJBm6)** - For building an amazing community around Flesh and Blood and to everyone who shared their 3-0 deck.
- **[FaBrary](https://fabrary.net/)** - For offering a robust deck-building and export platform.

## Disclaimer
This site is not affiliated with Legend Story Studios.
Legend Story Studios®, Flesh and Blood™, and all associated set names are trademarks of Legend Story Studios.
All Flesh and Blood artwork, card images, and characters are the property of Legend Story Studios. © Legend Story Studios.
This site does not distribute or sell any copyrighted material.
If you are a rights holder and have concerns, please [open a GitHub issue](https://github.com/petr7410/fab-3-0-analysis/issues) or contact me directly at **petr7410.contact@gmail.com**.