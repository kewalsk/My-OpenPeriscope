# My-OpenPeriscope

<img align="right" src="https://raw.githubusercontent.com/Pmmlabs/OpenPeriscope/master/images/openperiscope.png">

Unofficial client for Periscope works in browser as userscript and as standalone node application.

## Based on original project [OpenPeriscope](https://github.com/Pmmlabs/OpenPeriscope)

Thanks to [Pmmlabs](https://github.com/Pmmlabs) for original idea and investigations.<br>
Buy a beer for him: [paypal.me/pmmlabs](https://paypal.me/pmmlabs)<br>
or donate by Bitcoin: [1F1hXcaTjS1UFUqqMzLvVyz4wDSbRJU4Tn](bitcoin:1F1hXcaTjS1UFUqqMzLvVyz4wDSbRJU4Tn) 

Thanks also to [gitnew2018](https://github.com/gitnew2018) for all the enhancement he has made on his fork.

### Features added in (my) version 0.1.7

* Sign in by SID button (in fact this is not sing in but reuse of existing session)
* Buttons to generate ffmpeg command and copy to clipboard


### Features added in [gitnew2018](https://github.com/gitnew2018/My-OpenPeriscope) version

* New broadcasts after refresh are highlited (marked in code as /* drkchange00 */)
* Now thumbnail previews of replays open in new window even in suerscript(drkchange01)
* Download button changes(drkchange02)
* You can select users who's braodcasts will be recorded(drkchange03)
* New video downloader based on Node.js. It's more reliable imho(drkchange04 and whole downloaderNode.js file)
* Preserve scroll position when switching to other subpages(drkchange05)
* Download Manager (drkchange06)
* Persistent links between refreshes (drkchange07)
* Rename video if one with same name exists (drkchange08)
* Copy link with name and cookies to be used in my periscope nodejs downloader,available in userscript only (drkchange09)
* Display full size avatars from google profiles (drkchange10)
* Dark theme (changes in style.css)
* some other minor tweaks.
* -----(added after 1 release)-----
* Option to log broadcasts to text file with link to replay(drkchange11)
* Profile avatar and link in chat messages + some styling (drkchange12 and style.css)
* Generate proper uuid for chat messages (drkchange13).
* Generate partial replay links (drkchange14)
* M3U links optional, on/off in settings (drkchange15)
* PeriscopeDownloader links optional, on/off in settings (drkchange16)
* Generated links stay grayed-out when no response is received (drkchange17)
* Changed Following broadcast feed to include deleted broadcasts and now broadcasts appear in new order. (drkchange18)
* "Sort by watching" is now toggle(drkchange19)
* "Show interesting only" - displays only the ones that you clicked on "get stream link"(drkchange20)
* When "Enable automatic downloading of the following items" or "Enable notifications" is on, replay links are saved and displayed on their boradcast card(drkchange21)
* In standalone version transitions in css caused heavy cpu usage. Now all are off.
* Added checkbox to activate auto getting partial replay links(drkchange22)
* Added filters. Hide replays, producer or by language (drkchange23)
* Saved broadcasts now have prefixes:PV_ PR_ R_(private, partial replay, replay) (drkchange24)
* Update state of broadcasts, updating thumbnails is optional (drkchange25)
* Seach by @username not only by user id (drkchange26)
* Screenlist now changed to screenPreviewer (drkchange01)
* Added input field to download manager to quickly download from web link (drkchange27)

### Using as standalone application

Pre-build releases for my version are not available (yet). You can use pre-built executables from [gitnew2018 Releases page](https://github.com/gitnew2018/My-OpenPeriscope/releases), or build it by yourself from source [gitnew2018 guide link](https://github.com/gitnew2018/My-OpenPeriscope/wiki).

### Using as userscript

1. Install [userscript manager](https://greasyfork.org/help/installing-user-scripts)
1. Click to [link](https://raw.githubusercontent.com/kewalsk/My-OpenPeriscope/master/Periscope_Web_Client.user.js) and then "Install"
1. Navigate to http://example.net

In this case posting to chat will not work.

In userscript version, "Download" link is absent, so you can use downloaderNode (or other program) to download broadcasts:

[gitnew2018 standalone periscope nodejs downloader](https://github.com/gitnew2018/nodejs_peri_downloader)

### Screenshot

![screenshot](https://user-images.githubusercontent.com/37026885/37880128-0360d5be-3084-11e8-8f32-77ae48a4896a.png)
