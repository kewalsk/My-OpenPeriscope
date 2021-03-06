﻿// ==UserScript==
// @id          My-OpenPeriscope@nothing.com
// @name        Periscope Web Client
// @namespace   https://greasyfork.org/users/nouser
// @description Periscope client based on API requests. Visit example.net for launch.
// @include     https://api.twitter.com/oauth/authorize
// @include     http://example.net/*
// @version     0.2.07
// @author      Pmmlabs@github modified by gitnew2018@github
// @grant       GM_xmlhttpRequest
// @connect     periscope.tv
// @connect     pscp.tv
// @connect     twitter.com
// @connect     digits.com
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.js
// @require     https://github.com/brix/crypto-js/raw/master/crypto-js.js
// @require     http://cdn.leafletjs.com/leaflet/v0.7.7/leaflet.js
// @require     http://leaflet.github.io/Leaflet.markercluster/dist/leaflet.markercluster-src.js
// @require     https://github.com/iamcal/js-emoji/raw/master/lib/emoji.js
// @require     https://github.com/Dafrok/if-emoji/raw/master/index.js
// @require     https://github.com/zenorocha/clipboard.js/raw/v2.0.0/dist/clipboard.min.js
// @require     https://github.com/le717/jquery-spoiler/raw/master/jquery.spoiler.min.js
// @require     https://github.com/gitnew2018/My-OpenPeriscope/raw/master/Groups.js
// @require     https://github.com/gitnew2018/My-OpenPeriscope/raw/master/Membership.js
// @require     https://github.com/gitnew2018/My-OpenPeriscope/raw/master/Channel.js
// @require     https://github.com/gitnew2018/My-OpenPeriscope/raw/master/ChannelMembers.js
// @require     https://github.com/gitnew2018/My-OpenPeriscope/raw/master/ApiTest.js
// @require     https://github.com/gitnew2018/My-OpenPeriscope/raw/master/PeriscopeApiWrapper.js
// @require     https://unpkg.com/split.js/dist/split.min.js
// @downloadURL https://github.com/gitnew2018/My-OpenPeriscope/raw/master/Periscope_Web_Client.user.js
// @updateURL   https://github.com/gitnew2018/My-OpenPeriscope/raw/master/Periscope_Web_Client.meta.js
// @icon        https://github.com/gitnew2018/My-OpenPeriscope/raw/master/images/openperiscope.png
// @noframes
// @grant       GM_addStyle
// @grant       GM_getResourceText
// @resource    CSS https://github.com/gitnew2018/My-OpenPeriscope/raw/master/style.css
// ==/UserScript==

var emoji = new EmojiConvertor();
var childProcesses=[]; //list of video downloading processes
var selectedDownloadList = localStorage.getItem('selectedUsersDownloadList') || "";
var IMG_PATH = 'https://github.com/gitnew2018/My-OpenPeriscope/raw/master';
var settings = JSON.parse(localStorage.getItem('settings')) || {};
const NODEJS = typeof require === 'function';
if (NODEJS) {  // for NW.js
    var gui = require('nw.gui');
    gui.App.addOriginAccessWhitelistEntry('https://api.twitter.com/', 'app', 'openperiscope', true);    // allow redirect to app://
    https = require('https');
    url = require('url');
    IMG_PATH = '';
    // Back & Forward hotkeys
    $(window).on('keydown', function (e) {
        if (e.keyCode == 8 && e.target == document.body) {  //backspace
            if (e.shiftKey)
                history.forward();
            else
                history.back();
        } else if (e.keyCode == 116)    //F5
            location.href='/index.html';
    });
    // default download path = executable path
    if (!settings.downloadPath)
        setSet('downloadPath', process.execPath.substring(0, process.execPath.lastIndexOf(process.platform === 'win32' ? '\\' : '/')));
    if (settings.windowSize)
        window.resizeTo(settings.windowSize.width, settings.windowSize.height);
    setTimeout(function(){
        $(window).resize(function (e) {
            setSet('windowSize', {
                width: $(this).width(),
                height: $(this).height()
            });
        })
    }, 1000);
}

if (location.href == 'https://api.twitter.com/oauth/authorize') {
    location.href = $('meta[http-equiv="refresh"]').attr('content').substr(6).replace('twittersdk://openperiscope/index.html', 'http://example.net/');
} else {
    $('style').remove();
    $(document.head).append('<meta name="referrer" content="no-referrer" />');
    if (NODEJS) {
        $(document.head).append('<link rel="stylesheet" href="/style.css" />')
    } else {
        var resourceText = GM_getResourceText("CSS").replace(/url\("/g, 'url("' + IMG_PATH);
        GM_addStyle(resourceText);
    }

    document.title = 'My-OpenPeriscope';
    var oauth_token = localStorage.getItem('oauth_token'),
        oauth_verifier = localStorage.getItem('oauth_verifier'),
        session_key = localStorage.getItem('session_key'),
        session_secret = localStorage.getItem('session_secret'),
        loginTwitter = localStorage.getItem('loginTwitter');

    $(function() {
        if (loginTwitter) {
            loginTwitter = JSON.parse(loginTwitter);
            Ready(loginTwitter);
            refreshProfile();
        } else if (session_key && session_secret) {
            SignIn3(session_key, session_secret);
        } else if (oauth_token && oauth_verifier) {
            SignIn2(oauth_token, oauth_verifier);
        } else if ((oauth_token = getParameterByName('oauth_token')) && (oauth_verifier = getParameterByName('oauth_verifier'))) {
            localStorage.setItem('oauth_token', oauth_token);
            localStorage.setItem('oauth_verifier', oauth_verifier);
            SignIn2(oauth_token, oauth_verifier);
        } else {
            var signInButton = $('<a class="button">Sign in with twitter</a>').click(SignIn1);
            var signInSMSButton = $('<a class="button">Sign in with SMS</a>').click(SignInSMS);
            var signInSidButton = $('<a class="button">Sign in with SID</a>').click(SignInSessionID);
            $(document.body).html('<input type="text" id="secret" size="60" placeholder="Enter periscope consumer secret here... or SID" value="' +
                (settings.consumer_secret || '') + '"/><br/>').append(signInButton, /* signInSMSButton,  */signInSidButton);
        }
        $(document.body).append(Progress.elem);
    });
}

function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}
function lazyLoad(parent) {
    var right = $('#right');
    $(parent).on('scroll', function () {
        clearTimeout($.data(this, 'scrollTimer'));      // for preventing dozens of firing
        $.data(this, 'scrollTimer', setTimeout(function () {
            var windowHeight = $(window).height();
            var scrollTop = $(window).scrollTop();
            right.find('img[lazysrc]:visible').each(function () {
                var el = $(this);
                var top = el.offset().top;
                if (scrollTop < top + el.height() + 800 && scrollTop + windowHeight + 800 > top) {  // 800 is handicap
                    el.attr('src', el.attr('lazysrc'));
                    el.removeAttr('lazysrc');
                }
            })
        }, 100));
    });
}
var selfAvatar;
function Ready(loginInfo) {
    console.log('ready! ', loginInfo);
    var signOutButton = $('<a class="button">Sign out</a>');
    signOutButton.click(SignOut);

    var userLink = $('<a class="username">@' + (loginInfo.user.username || loginInfo.user.twitter_screen_name) + '</a>').click(switchSection.bind(null, 'User', loginInfo.user.id));
    var userEdit = $('<span class="right icon edit" title="Profile & settings">&nbsp;</span>').click(switchSection.bind(null, 'Edit'));
    loginInfo.user.profile_image_urls.sort(function (a, b) {
        return a.width * a.height - b.width * b.height;
    });
    selfAvatar = $('<img src="' + loginInfo.user.profile_image_urls[0].url + '" width="140"/>');
    var left = $('<div id="left"/>').append(signOutButton,
        selfAvatar, userEdit,
        '<div>' + emoji_to_img(loginInfo.user.display_name) + '</div>', userLink);
    $(document.body).html(left).append('<div id="right"/>', Progress.elem);
    var menu = [
        {text: 'API test', id: 'ApiTest'},
        {text: 'Map', id: 'Map'},
        {text: 'Top', id: 'Top'},
        {text: 'Following', id: 'Following'},
        {text: 'Search broadcasts', id: 'Search'},
        {text: 'New broadcast', id: 'Create'},
        {text: 'Chat', id: 'Chat'},
        {text: 'Suggested people', id: 'People'},
        {text: 'User', id: 'User'},
        {text: 'Groups', id: 'Groups'},
        {text: 'Membership', id: 'Membership'},
        {text: 'Channel', id: 'Channel'}
    ];
    if (NODEJS){
    menu.push({text: 'Download manager', id: 'Dmanager'});
        menu.push({text: 'Downloading', id: 'Console'});
    }
    for (var i in menu) {
        var link = $('<div class="menu" id="menu'+menu[i].id+'">' + menu[i].text + '</div>');
        link.click(switchSection.bind(null, menu[i].id));
        left.append(link);
    }
    $('.menu').first().click();
    $('#menuCreate').hide(); // Create broadcasts only for developers
    left.append($('<label title="All API requests will be logged to console"/>').append($('<input type="checkbox" id="debug"/>').click(function(){
        $('#menuCreate').toggle();
    }), 'Debug mode'));
    emoji.img_sets[emoji.img_set].path = 'http://unicodey.com/emoji-data/img-apple-64/';
    emoji.supports_css = true;
    emoji.replace_mode = 'css';
    lazyLoad(window);
    $(window).on('popstate', function(event) {
        event = event.originalEvent;
        if (event.state && event.state.section)
            switchSection(event.state.section, event.state.param, true);
    });
    Notifications.start();
}
var Notifications = {
    interval: null,
    notifs_available: null,
    old_list: null,
    default_interval: 15,
    default_replay_limit: 3600,
    start: function () {
        if (!this.interval) {
            if (typeof this.notifs_available !== 'boolean') {
                this.notifs_available = false;
                if ("Notification" in window && Notification.permission === "granted")
                    this.notifs_available = true;
                else if (Notification.permission !== 'denied')
                    Notification.requestPermission(function (permission) {
                        if (permission === "granted")
                            Notifications.notifs_available = true;
                    });
            }
            this.old_list = JSON.parse(localStorage.getItem('followingBroadcastFeed')) || [];
            if (!settings.followingInterval)
                setSet('followingInterval', this.default_interval);
                if (!settings.replayTimeLimit)
                setSet('replayTimeLimit', this.default_replay_limit);
            if (settings.followingNotifications || settings.automaticDownload)
                this.interval = setInterval(PeriscopeWrapper.V2_POST_Api.bind(null, 'followingBroadcastFeed', {}, function (new_list) {
                    var getReplayUrl;
                    var cardsContainer = $('#right > div:visible > div');
                    var new_list_ids =[];
                    for (var i in new_list) {
                        var contains = false;
                        var stateChanged = false;
                        new_list_ids.push(new_list[i].id);
                        var repeatInteresting = broadcastsCache.autoGettinList.indexOf(new_list[i].id) >= 0;
                        var broadcastCard = cardsContainer.find('.card.' + new_list[i].id).not('.downloadCard, .cardProfileImg');
                        broadcastCard.removeClass('RUNNING').addClass(new_list[i].state);

                        if (new_list[i].state === 'RUNNING' && settings.updateThumbnails){
                            var oldImage = broadcastCard.find('.lastestImage img')[0];
                            oldImage ? oldImage.src ? oldImage.src = new_list[i].image_url_small : '' : '' ;
                        }
                        for (var j in Notifications.old_list)
                            if (Notifications.old_list[j].id == new_list[i].id) {
                                contains = true;
                                if((new_list[i].state === 'ENDED' || new_list[i].state === 'TIMED_OUT') && (Notifications.old_list[j].state === 'RUNNING')){
                                    stateChanged = true;
                                    if(repeatInteresting)  {
                                        broadcastsCache.autoGettinList.splice(broadcastsCache.autoGettinList.indexOf(new_list[i].id),1)
                                        repeatInteresting = false;
                                    }
                                }
                                break;
                            }
                        if (!contains) { // NEW BRDCST!
                            // Show notification
                            if (settings.followingNotifications && Notifications.notifs_available) {
                                setTimeout(function (i) {   // fix for massive firing
                                    return function () {
                                        var date_created = new Date(new_list[i].start);
                                        var start = date_created.getFullYear() + '-' + zeros(date_created.getMonth() + 1) + '-' + zeros(date_created.getDate()) + '_' + zeros(date_created.getHours()) + ':' + zeros(date_created.getMinutes());
                                        new Notification(new_list[i].user_display_name + (new_list[i].state == 'RUNNING' ? ' is live now' : ' uploaded replay'), {
                                            body: '[' + start + '] ' + (new_list[i].status || 'Untitled'),
                                            icon: new_list[i].image_url
                                        }).onclick = function () {
                                            window.open('https://www.periscope.tv/w/' + new_list[i].id);
                                            this.close();
                                        };
                                    };
                                }(i), 300 * i);
                            }
                            // Start the record
                            if (settings.automaticDownload && new_list[i].state == 'RUNNING' && NODEJS) {
                                var downloadBroadcast = false;

                                if (settings.privateDownload && new_list[i].is_locked)
                                    downloadBroadcast = true;
                                else if (settings.sharedDownload && new_list[i].share_user_ids)
                                    downloadBroadcast = true;
                                else if (settings.followingDownload && !new_list[i].share_user_ids)
                                    downloadBroadcast = true;
                                else if (settings.selectedDownload && selectedDownloadList.includes(new_list[i].user_id))
                                    downloadBroadcast = true;
                                if (downloadBroadcast) {
                                    if(settings.replayTimeLimit > 2){
                                        let liveUrl;
                                        let urlCallback = function (live, replay, cookies, _name, _folder_name, _broadcast_info, _partial_replay) {
                                            if(live){
                                                let savedLinks = broadcastsWithLinks[_broadcast_info.id];
                                                (_broadcast_info.is_locked && (savedLinks && !savedLinks.hasOwnProperty('decryptKey') || !savedLinks)) ? saveDecryptionKey(live, _broadcast_info.id, cookies, false) : '';//save key while it's live
                                                liveUrl = live;
                                                getURL(_broadcast_info.id, urlCallback, true, true);
                                            }else if(replay){
                                                download(_folder_name, _name, liveUrl, replay, cookies, _broadcast_info, null, true);
                                            }else if(live === null && replay === null && liveUrl){//when live just started and no partial replay available
                                                download(_folder_name, _name, liveUrl, '', cookies, _broadcast_info);
                                            }
                                        }
                                        getURL(new_list[i].id, urlCallback);
                                    }else{
                                        getURL(new_list[i].id, function (live, replay, cookies, _name, _folder_name, _broadcast_info) {
                                            if (live){
                                                let savedLinks = broadcastsWithLinks[_broadcast_info.id];
                                                (_broadcast_info.is_locked && (savedLinks && !savedLinks.hasOwnProperty('decryptKey') || !savedLinks)) ? saveDecryptionKey(live, _broadcast_info.id, cookies, false) : '';//save key while it's live
                                                download(_folder_name, _name, live, '', cookies, _broadcast_info);
                                            } else if (replay)
                                                download(_folder_name, _name, '', replay, cookies, _broadcast_info);
                                        });
                                    }
                                }
                            }
                            //save decryption key 
                            if (!downloadBroadcast){//no need to duplicate requests for key when it's auto downloading broadcast
                            getURL(new_list[i].id, function (live, replay, cookies, _name, _folder_name, _broadcast_info) {
                                    var savedLinks = broadcastsWithLinks[_broadcast_info.id];
                                    if(_broadcast_info.is_locked && (savedLinks && !savedLinks.hasOwnProperty('decryptKey') || !savedLinks)){
                                        live ? '' : live = replay;
                                        saveDecryptionKey(live, _broadcast_info.id, cookies, false);
                                    }
                                })
                            }//save decryption key end
                        }
                        // log live broadcasts to a file
                        if (!contains || stateChanged || repeatInteresting) { // NEW BRDCST! or changed state from live to replay
                            if((NODEJS && settings.logToFile && !(new_list[i].state === 'ENDED' || new_list[i].state === 'TIMED_OUT' )) && !repeatInteresting){
                                const fs = require('fs');
                                var date_start = new Date(new_list[i].start);

                                fs.appendFile(settings.downloadPath + '/' + 'Broadcasts_log.txt', ('* ' + '-LIVE- ' + (new_list[i].is_locked ? 'PRIVATE ' : '') + 'start@'
                                + zeros(date_start.getHours()) + ':' + zeros(date_start.getMinutes()) + ' **' + new_list[i].user_display_name + '** (@' + new_list[i].username + ')(**ID:** ' + new_list[i].id + ') **' + (new_list[i].status || 'Untitled') + ',** [' + new_list[i].language + '] '
                                + (new_list[i].share_display_names ? ['*shared by:* ' + new_list[i].share_display_names[0]] : '') + (new_list[i].channel_name ? [' *on:* ' + new_list[i].channel_name] : '') + '\n'),
                                'utf8',function () {}); //log broadcasts to .txt
                            }

                            if(new_list[i].state === 'ENDED' || new_list[i].state === 'TIMED_OUT' || repeatInteresting){
                                getReplayUrl = function (live, replay, cookies, _name, _folder_name, _broadcast_info, _partial_replay) {
                                    // log ended broadcasts to a file
                                    if(NODEJS && settings.logToFile && !_partial_replay && !repeatInteresting){
                                        const fs = require('fs');
                                        var date_start = new Date(_broadcast_info.start);
                                        var savedLinks = broadcastsWithLinks[_broadcast_info.id];

                                        fs.appendFile(settings.downloadPath + '/' + 'Broadcasts_log.txt', ('* ' +  'REPLAY ' + (_broadcast_info.is_locked ? 'PRIVATE ' : '') + 'start@'
                                        + zeros(date_start.getHours()) + ':' + zeros(date_start.getMinutes()) + ' **' + _broadcast_info.user_display_name + '** (@' + _broadcast_info.username + ')(**ID:** ' + _broadcast_info.id + ') **' + (_broadcast_info.status || 'Untitled') + ',** [' + _broadcast_info.language + '] '
                                        +  ((savedLinks && savedLinks.hasOwnProperty('decryptKey'))? ('**KEY:** ' + savedLinks.decryptKey) : '') + '\n' + (replay ? (replay + '\n') : '')),
                                        'utf8',function () {}); //log replays to .txt 
                                    }
                                    ////////// log live broadcasts to a file end
                                    if(live){
                                        setTimeout(function (a1,a2) {//some are ended in following feed and running when you try to get replay url
                                            getURL(a1, a2);
                                        }, 1000, _broadcast_info.id, getReplayUrl);

                                    }else if (replay){
                                        var attachReplayLinks = function(keyFail){
                                            if(!keyFail){
                                                limitAddIDs(broadcastsWithLinks, _broadcast_info.id, 200, []);

                                                var clipboardLink = $('<a data-clipboard-text="' + replay + '" class="'+ (_partial_replay ? 'linkPartialReplay':'linkReplay') + ' button2" title="Copy ' + (_partial_replay ? 'partial ' : '') + 'replay URL">'+ (_partial_replay ? 'Copy PR_URL':'Copy R_URL') +'</a>');
                                                new ClipboardJS(clipboardLink.get(0));

                                                var clipboardDowLink = $('<a data-clipboard-text="' + 'node periscopeDownloader.js ' + '&quot;' + replay + '&quot;' + ' ' + '&quot;' + (_name || 'untitled') + '&quot;' + ( _broadcast_info.is_locked ? (' ' + '&quot;' + cookies + '&quot;') : '') + '" class="' + (_partial_replay ? 'linkPartialReplay':'linkReplay') + ' button2">' + (_partial_replay ? 'PR_NodeDown' : 'R_NodeDown') + '</a>');
                                                new ClipboardJS(clipboardDowLink.get(0));

                                                var downloadLink = $('<a class="'+ (_partial_replay ? 'linkPartialReplay':'linkReplay') + ' button2" title="Download replay">▼</a>').click(switchSection.bind(null, 'Console', {url: '', rurl: replay, cookies: cookies, name: _name, folder_name: _folder_name, broadcast_info: _broadcast_info}));
                                                var refreshIndicator = $('<a> ◄</>')

                                                setTimeout(function(){refreshIndicator.hide()}, 2000);
                                                var showDowLink = !NODEJS && (settings.showNodeDownLinks || (settings.showNodeDownLinksPrv && _broadcast_info.is_locked));
                                                var card = cardsContainer.find('.card.' + _broadcast_info.id);

                                                card.find('.responseLinks').empty();
                                                card.find('.responseLinksReplay').empty().append(
                                                    (NODEJS ? [downloadLink,' | '] : ''),clipboardLink, showDowLink ? [' | ', clipboardDowLink] : '', refreshIndicator
                                                );

                                                var linksObj = {
                                                    RdownloadLink : downloadLink.clone(true,true),
                                                    RclipboardLink : clipboardLink.clone(),
                                                    RclipboardDowLink : clipboardDowLink.clone()
                                                }
                                                
                                                broadcastsWithLinks.addToBroadcastsLinks(_broadcast_info.id, linksObj)
                                            }
                                        }
                                        
                                        var savedLinks = broadcastsWithLinks[_broadcast_info.id];
                                        if(_broadcast_info.is_locked && (savedLinks && !savedLinks.hasOwnProperty('decryptKey') || !savedLinks)){
                                            saveDecryptionKey(replay, _broadcast_info.id, cookies, false, attachReplayLinks);
                                        }else{
                                            attachReplayLinks();
                                        }
                                    }
                                }
                                getURL(new_list[i].id, getReplayUrl, repeatInteresting);
                            }
                        }
                    }
                    for (var m in broadcastsCache.idsQueue){//update state of deleted broadcasts
                        if(new_list_ids.indexOf(broadcastsCache.idsQueue[m]) < 0){
                            var bid = broadcastsCache.idsQueue[m];
                            var card = cardsContainer.find( '.card.' + bid).not('.downloadCard, .cardProfileImg');
                            if(!card.hasClass('deletedBroadcast')){
                                card.removeClass('RUNNING').addClass('ENDED deletedBroadcast');
                            }
                        }
                    }

                    for (var l = new_list.length - 1; l >= 0  ; l--) {
                        broadcastsCache[new_list[l].id] = $.extend({}, new_list[l]);
                        limitAddIDs(broadcastsCache, new_list[l].id, 100, new_list_ids);
                    }

                    for (var n in broadcastsCache.idsQueue) {
                        cardsContainer.find('.card.' + broadcastsCache.idsQueue[n]).not('.downloadCard, .cardProfileImg').find('.recContainer').empty().append(downloadStatus(broadcastsCache.idsQueue[n], true));
                    }
                    
                    Notifications.old_list = new_list;
                    localStorage.setItem('followingBroadcastFeed', JSON.stringify(Notifications.old_list));
                }), (settings.followingInterval || this.default_interval) * 1000);
        }
    },
    stop: function () {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
};
var ScrollPositions={}
function switchSection(section, param, popstate) {
    ScrollPositions[document.URL.split('/')[3]] = window.pageYOffset;
    // Switch menu
    $('.menu.active').removeClass('active');
    $('#menu'+section).addClass('active');
    // Switch content
    $('#right > div:visible').hide();
    if (param && param.target)  // jQuery event
        param = null;
    if (popstate != true)
        history.pushState({section: section, param: param}, section, '/' + section + (param ? '/' + (param.url ? param.url : (param.rurl ? param.rurl : param)) : ''));
    var sectionContainer = $('#' + section);
    if (!sectionContainer.length)
        Inits[section]();
    else {
        var refreshSettingKey = "refresh" + section + "OnLoad";
        if (settings[refreshSettingKey]) {
            var refreshBtn = $('#refresh' + section);
            if (refreshBtn.length > 0) {
                ScrollPositions[section] = 0;
                refreshBtn.click();
            }
        }
        sectionContainer.show();
    }
    if (param)
        switch (section) {
            case 'User':
                if ($('#user_id').val() != param) {
                    $('#user_id').val(param);
                    $('#user_name').val('');
                    $('#showuser').click();
                }
                break;
            case 'Chat':
                if ($('#broadcast_id').val() != param) {
                    $('#broadcast_id').val(param);
                    $('#startchat').click();
                }
                break;
            case 'Map':
                var latlng = param.split(',');
                var mapcenter = map.getCenter();
                if (latlng[0] != mapcenter.lat || latlng[1] != mapcenter.lng)
                    map.setView([latlng[0], latlng[1]], 17);
                break;
            case 'Console':
                param = $.extend({
                    url:'',
                    rurl:'',
                    cookies: '',
                    name:'',
                    folder_name:'',
                    broadcast_info:''
                }, param);
                if (($('#download_url').val() != param.url) || ($('#download_replay_url').val() != param.rurl)) {    // if it other video
                    $('#download_url').val(param.url);
                    $('#download_replay_url').val(param.rurl);
                    $('#download_cookies').val(param.cookies);
                    $('#download_name').val(param.name);
                    $('#download_folder_name').val(param.folder_name);
                    $('#download_response').val(JSON.stringify(param.broadcast_info));
                    $('#download').click();
                }
                break;
            case 'Channel':
                if ($('#channel_id').val() != param) {
                    $('#channel_id').val(param);
                    $('#showchannel').click();
                }
                break;
        }
    if(section == 'Dmanager')
        $('#' + section).remove(), Inits[section](param ? param : '');
    document.title = section + ' - ' + 'My-OpenPeriscope';
    if (ScrollPositions.hasOwnProperty(section)) {
        window.scrollTo(0, ScrollPositions[section]);
    }
}
var Progress = {
    elem: $('<div id="progress"/>'),
    count: 0,
    start: function(){
        this.count++;
        this.elem.css('visibility', 'visible');
        this.elem.css('width', Math.floor(100/this.count)+'%');
    },
    stop: function(){
        this.count--;
        if (!this.count) {  // if there is no unfinished requests
            this.elem.css('width', '0');
            this.elem.css('visibility', 'hidden');
        } else
            this.elem.css('width', Math.floor(100/this.count)+'%');
    }
};
var languageSelect = '<dt>Language: <select class="lang">\
            <option>ar</option>\
            <option>da</option>\
            <option>de</option>\
            <option>en</option>\
            <option>es</option>\
            <option>fi</option>\
            <option>fr</option>\
            <option>he</option>\
            <option>hy</option>\
            <option>id</option>\
            <option>it</option>\
            <option>ja</option>\
            <option>kk</option>\
            <option>ko</option>\
            <option>nb</option>\
            <option>pl</option>\
            <option>other</option>\
            <option>pt</option>\
            <option>ro</option>\
            <option>ru</option>\
            <option>sv</option>\
            <option>tr</option>\
            <option>uk</option>\
            <option>zh</option>\
            <option>all</option>\
        </select></dt>';
function refreshProfile() {
    PeriscopeWrapper.V2_POST_Api('user', {
        user_id: loginTwitter.user.id
    }, function (userResponse) {
        loginTwitter.user = userResponse.user;
        localStorage.setItem('loginTwitter', JSON.stringify(loginTwitter));
        loginTwitter.user.profile_image_urls.sort(function (a, b) {
            return a.width * a.height - b.width * b.height;
        });
        if (selfAvatar.attr('src') != loginTwitter.user.profile_image_urls[0].url)
            selfAvatar.attr('src', loginTwitter.user.profile_image_urls[0].url);
    })
}
var Inits= {
Map: function () {
    $(document.head).append('<link rel="stylesheet" href="http://cdn.leafletjs.com/leaflet/v0.7.7/leaflet.css" />',
        '<link rel="stylesheet" href="http://leaflet.github.io/Leaflet.markercluster/dist/MarkerCluster.css" />');
    var mapList = $('<div class="split"/>');
    $('#right').append($('<div id="Map"/>').append('<div id="map" class="split"/>',mapList));
    // Set center
    map = L.map('map', {zoomControl: false}).setView([0, 0], 2);

    // Layers list
    var tileLayers = {
        "Open Street Map": L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data &copy; OpenStreetMap'
        }).addTo(map),
        "Mapbox": L.tileLayer('http://{s}.tiles.mapbox.com/v4/mapbox.streets/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWZ4IiwiYSI6IjNFcEppQlkifQ.qQjCuUBY9_739UXnMknMVw', {
        attribution: 'Map data &copy; OpenStreetMap'
        }),
        "Google": L.tileLayer('http://mt{s}.google.com/vt/x={x}&y={y}&z={z}', {
            subdomains: '123',
            attribution: 'Map data &copy; Google'
        })
    };
    L.control.layers(tileLayers).addTo(map);
    // Split panel opener
    var splitPanelEnabled = false;
    L.Control.PanelButton = L.Control.extend({
        onAdd: function(amap) {
            return $('<div class="leaflet-control-layers leaflet-control"/>')
                .append($('<a class="bullets" title="Toggle broadcasts list"/>').click(function(){
                    if (splitPanelEnabled) {
                        $('.gutter').remove();
                        $(amap.getContainer()).css('width','');
                        mapList.css('width','0');
                    } else {
                        Split($('.split'), {
                            sizes: [80, 20],
                            minSize: [100, 100]
                        });
                    }
                    splitPanelEnabled = !splitPanelEnabled;
                }))
                .get(0);
        },

        onRemove: function(amap) {
        }
    });
    new L.Control.PanelButton().addTo(map);
    // Search
    var searcher = false;
    L.Control.Searcher = L.Control.extend({
        onAdd: function (amap) {
            return $('<div class="leaflet-control searcher"/>')
                .append($('<input type="text" placeholder="Search..."/>')
                    .mousemove(function () {return false})
                    .dblclick(function () {return false})
                    .keypress(function (e) {
                        if (e.keyCode == 13) {
                            var $this = $(this);
                            $.get('https://maps.googleapis.com/maps/api/geocode/json', {
                                address: $(this).val(),
                                key: 'AIzaSyChqVpIwX4UYEh-1Rza_OqTl1OwYfupWBE'  // key quota is 2500 requests per day \_(-_-)_/
                            }, function (r) {
                                if (r.results.length) {
                                    amap.fitBounds([
                                        [r.results[0].geometry.viewport.southwest.lat, r.results[0].geometry.viewport.southwest.lng],
                                        [r.results[0].geometry.viewport.northeast.lat, r.results[0].geometry.viewport.northeast.lng]
                                    ]);
                                } else {
                                    $this.css('transition', '');
                                    $this.css('color', 'red');
                                    setTimeout(function () {
                                        $this.css('transition', 'color 4s ease-out');
                                        $this.css('color', '');
                                    }, 100);
                                }
                            });
                            return false;
                        }
                    }))
                .get(0);
        }
    });
    new L.Control.Searcher({position: 'topleft'}).addTo(map);
    new L.Control.Zoom().addTo(map);
    // Cluster icons
    var iconCreate = function (prefix) {
        return function (cluster) {
            var childCount = cluster.getChildCount();
            var c = ' ' + prefix + '-cluster-';
            if (childCount < 10) {
                c += 'small';
            } else if (childCount < 100) {
                c += 'medium';
            } else {
                c += 'large';
            }
            return new L.DivIcon({
                html: '<div><span>' + childCount + '</span></div>',
                className: 'marker-cluster' + c,
                iconSize: new L.Point(40, 40)
            });
        };
    };
    var replay = L.markerClusterGroup({
        showCoverageOnHover: false,
        disableClusteringAtZoom: 16,
        singleMarkerMode: true,
        iconCreateFunction: iconCreate('replay')
    }).addTo(map);
    var live = L.markerClusterGroup({
        showCoverageOnHover: false,
        disableClusteringAtZoom: 16,
        singleMarkerMode: true,
        iconCreateFunction: iconCreate('live')
    }).addTo(map);
    var refreshMap = function () {
        //if (e && e.hard === false) return;    // zoom change case
        var mapBounds = map.getBounds();
        clearXHR();
        if (mapBounds._northEast.lat == mapBounds._southWest.lat && mapBounds._northEast.lng == mapBounds._southWest.lng)
            console.warn('Map is out of mind');
        PeriscopeWrapper.V2_POST_Api('mapGeoBroadcastFeed', {
            "include_replay": true,
            "p1_lat": mapBounds._northEast.lat,
            "p1_lng": mapBounds._northEast.lng,
            "p2_lat": mapBounds._southWest.lat,
            "p2_lng": mapBounds._southWest.lng
        }, function (r) {
            var openLL; // for preventing of closing opened popup
            live.eachLayer(function (layer) {
                if (layer.getPopup()._isOpen)
                    openLL = layer.getLatLng();
                else
                    live.removeLayer(layer);
            });
            replay.eachLayer(function (layer) {
                if (layer.getPopup()._isOpen)
                    openLL = layer.getLatLng();
                else
                    replay.removeLayer(layer);
            });
            // adding markers
            for (var i = 0; i < r.length; i++) {
                var stream = r[i];
                var marker = L.marker(new L.LatLng(stream.ip_lat, stream.ip_lng), {title: stream.status || stream.user_display_name});
                if (!marker.getLatLng().equals(openLL)) {
                    var description = getDescription(stream);
                    marker.bindPopup(description);
                    marker.on('popupopen', getM3U.bind(null, stream.id, $(description)));
                    marker.on('popupopen', PeriscopeWrapper.V2_POST_Api.bind(null, 'getBroadcasts', {
                        broadcast_ids: [stream.id],
                        only_public_publish: true
                    }, function (info) {
                        $('.leaflet-popup-content .watching').text(info[0].n_watching + info[0].n_web_watching);
                    }));
                    marker.on('popupopen', function (e) {
                        var img = $(e.popup._content).find('img');
                        img.attr('src', img.attr('lazysrc'));
                        img.removeAttr('lazysrc');
                    });
                    (stream.state == 'RUNNING' ? live : replay).addLayer(marker);
                }
            }
            if (splitPanelEnabled)
                refreshList(mapList)(r);
        });
        var mapCenter = map.getCenter();
        history.replaceState({
            section: 'Map',
            param: mapCenter.lat + ',' + mapCenter.lng
        }, 'Map', '/Map/' + mapCenter.lat + ',' + mapCenter.lng);
    };
    if (!history.state.param) {
        if (navigator.geolocation)
            navigator.geolocation.getCurrentPosition(function (position) {
                map.setView([position.coords.latitude, position.coords.longitude], 11);
                refreshMap();
            }, function(){
                refreshMap();
            });
    }
    map.on('moveend', refreshMap);
    lazyLoad(mapList);
},
ApiTest: function () {
    ApiTestController.init($('#right'));
},
Groups: function (){
    GroupsController.init($('#right'), function() {});
},
Membership: function () {
    MembershipController.init($('#right'), function() {});
},
Channel: function () {
    ChannelController.init($('#right'), function() {});
},
Top: function () {
    var featured = $('<div/>');
    var ranked = $('<div/>');
    var langDt = $(languageSelect);
    langDt.find(":contains(" + (navigator.language || navigator.userLanguage || "en").substr(0, 2) + ")").attr("selected", "selected");
    var button = $('<a class="button" id="refreshTop">Refresh</a>').click(function () {
        PeriscopeWrapper.V2_POST_Api('rankedBroadcastFeed', {languages: (langDt.find('.lang').val() == 'all') ? ["ar","da","de","en","es","fi","fr","he","hy","id","it","ja","kk","ko","nb","pl","other","pt","ro","ru","sv","tr","uk","zh"] : [langDt.find('.lang').val()]}, refreshList(ranked, '<h3>Ranked</h3>'));
        PeriscopeWrapper.V2_POST_Api('featuredBroadcastFeed', {}, refreshList(featured, '<h3>Featured</h3>'));
    });

    if (!settings.refreshTopOnLoad)
        setSet('refreshTopOnLoad', false);

    var refreshOnLoadBtn = $('<input id="refreshTopOnLoad" type="checkbox">').change(function () {
        setSet('refreshTopOnLoad', this.checked);
    });
    refreshOnLoadBtn.prop("checked", settings.refreshTopOnLoad);

    var refreshOnLoad = $('<label/>Refresh on load</label>').prepend(refreshOnLoadBtn);

    var TopObj = $('<div id="Top"/>').append(langDt, button, refreshOnLoad, featured, ranked);
    $('#right').append(TopObj);

    button.click();
},
Search: function () {
    var searchResults = $('<div/>');
    var channels = $('<div/>');
    var searchBroadcast = function (query) {
        if (typeof query == 'string')
            input.val(query);
        PeriscopeWrapper.V2_POST_Api('broadcastSearch', {
            search: input.val(),
            include_replay: $('#includeReplays')[0].checked
        }, refreshList(searchResults, '<h3>Search results for '+input.val()+'</h3>'));
    };
    var searchButton = $('<a class="button">Search</a>').click(searchBroadcast);
    var langDt = $(languageSelect).change(RefreshChannels);
    langDt.find(":contains(" + (navigator.language || navigator.userLanguage || "en").substr(0, 2) + ")").attr("selected", "selected");

    function RefreshChannels() {
        channels_url_root = 'https://channels.periscope.tv/v1/channels'
        PeriscopeWrapper.V1_GET_ApiChannels(function (response) {
            channels.empty();
            for (var i in response.Channels) {
                /**
                 * CID: "18168968415973012523"
                 * CreatedAt: "2017-06-08T16:14:47.180165658Z"
                 * Description: "Broadcasts featured by the Periscope editors."
                 * Featured: false
                 * LastActivity: "2019-08-16T03:36:53.234156058Z"
                 * NLive: 1
                 * NMember: 5
                 * Name: "Featured Broadcasts"
                 * OwnerId: "1xnjrzoXMyjYD"
                 * PublicTag: ""
                 * Slug: "featured-broadcasts"
                 * ThumbnailURLs: null
                 * Type: 2
                 * UniversalLocales: null
                 */                
                var channel = response.Channels[i];
                var Name = $('<a>' + channel.Name + '</a>').click(searchBroadcast.bind(null, channel.Name));
                var PublicTag = $('<a>' + channel.PublicTag + '</a>').click(searchBroadcast.bind(null, channel.PublicTag));
                var PublicChannel = $('<a>' + channel.Name + '</a>').click(PeriscopeWrapper.V1_GET_ApiChannels.bind(null, function (channelName) {
                    return function (chan) {
                        var ids = [];
                        for (var i in chan.Broadcasts)
                            ids.push(chan.Broadcasts[i].BID);
                        PeriscopeWrapper.V2_POST_Api('getBroadcasts', {
                            broadcast_ids: ids,
                            only_public_publish: true
                        }, refreshList(searchResults, '<h3>' + channelName + ', ' + chan.NLive + ' lives, ' + chan.NReplay + ' replays</h3>'));
                    };
                }(channel.Name), channels_url_root + '/' + channel.CID + '/broadcasts', langDt));
                channels.append($('<p/>').append('<div class="lives right icon" title="Lives / Replays">' + channel.NLive + ' / ' + channel.NReplay + '</div>',
                    PublicChannel, (channel.Featured ? ' FEATURED<br>' : ''), '<br>',
                    (channel.PublicTag ? ['Tags: ', Name, ', ', PublicTag, '<br>'] : ''),
                    'Description: ' + channel.Description)
                );
            }
        }, channels_url_root, langDt);
}

    var input = $('<input type="text">').keypress(function (e) {
        if (e.keyCode == 13) {
            searchBroadcast();
            return false;
        }
    });
    $('#right').append($('<div id="Search"/>').append(input, '<label><input id="includeReplays" type="checkbox"> Include replays</label>&nbsp;&nbsp;&nbsp;', searchButton,
        '<h3>Channels</h3>', langDt, '<br><br>', channels, searchResults));
    RefreshChannels();
},

Following: function () {
    var result = $('<div/>');
    var button = $('<a class="button" id="refreshFollowing">Refresh</a>').click(PeriscopeWrapper.V2_POST_Api.bind(null, 'followingBroadcastFeed', {}, refreshList(result , null, 'following')));

    var hideEnded = $('<label><input type="checkbox"' + (broadcastsCache.filters.hideEnded ? 'checked' : '') + '/> Hide non-live</label>').click(function (e) {
        $('#Following').find('.card').not('.RUNNING').not('.newHighlight');//cardsToHide
        broadcastsCache.filters.hideEnded = e.target.checked;
        applyFilters();
    });
    var hideProducer = $('<label><input type="checkbox"' + (broadcastsCache.filters.hideProducer ? 'checked' : '') + '/> Hide non-private producer</label>').click(function (e) {
        $('#Following').find('.producer').not('.newHighlight').not('.private');//cardsToHide
        broadcastsCache.filters.hideProducer = e.target.checked;
        applyFilters();
    });
    var languagesFilter = $('<fieldset class="languageFilter"><legend>Languages:</legend></fieldset>');
    for(var i in broadcastsCache.filters.languages){
        languagesFilter.append(
            $('<label><input type="checkbox"' + (broadcastsCache.filters.languagesToHide.some(function(r){return broadcastsCache.filters.languages[i].indexOf(r) >= 0}) ? '' : 'checked') + '/> ' + i + '</label>').change(
            {param: broadcastsCache.filters.languages[i]}, function(e){
                var toHideList = broadcastsCache.filters.languagesToHide;
                var arr = (typeof e.data.param != 'string') ? 'true' : '';
                if(arr){
                    if(e.target.checked){
                        e.data.param.forEach(function(a){
                            toHideList.splice(toHideList.indexOf(a),1);
                        });
                    }else{
                        e.data.param.forEach(function(a){
                            toHideList.push(a)
                        });
                    }
                }else{
                    if(e.target.checked){
                        toHideList.splice(toHideList.indexOf(e.data.param),1);
                    }else{
                        toHideList.push(e.data.param);
                    }
                }
                applyFilters();
            })
        );
    }
    function applyFilters(){
        var cards = $('#Following').find('.card').not('.newHighlight');
        cards.each(function(index, card){
            card = $(card);
            var hide = false;
            broadcastsCache.filters.hideEnded && !card.hasClass('RUNNING') ? hide = true : '';
            broadcastsCache.filters.hideProducer && card.hasClass('producer') ? hide = true : '';
            broadcastsCache.filters.languagesToHide.indexOf(card[0].getAttribute('lang')) >= 0 ? hide = true : '';
            hide ? card.hide() : card.show();
            $(window).trigger('scroll');    // for lazy load
        });
    }
    var filterBox = $('<div id="followingFilters"></div>').hide();
    filterBox.append(languagesFilter, hideEnded, hideProducer)
    var filtersToggle = $('<a class="button" style="float:right">Filters</a></br>').click(function(){filterBox.toggle()});
    
    if (!settings.classic_cards_order)
        setSet('classic_cards_order', false);
    var classicOrderBtn = $('<input id="classicOrder" type="checkbox">').change(function () {
        setSet('classic_cards_order', this.checked);
    });
    classicOrderBtn.prop("checked", settings.classic_cards_order);

    var classic_order = $('<label> Classic Order</label>').prepend(classicOrderBtn);

    if (!settings.refreshFollowingOnLoad)
        setSet('refreshFollowingOnLoad', false);
    var refreshOnLoadBtn = $('<input id="refreshFollowingOnLoad" type="checkbox">').change(function () {
        setSet('refreshFollowingOnLoad', this.checked);
    });
    refreshOnLoadBtn.prop("checked", settings.refreshFollowingOnLoad);

    var refreshOnLoad = $('<label> Refresh on load</label>').prepend(refreshOnLoadBtn);
    var optionsContainer = $('<span id="optionsContainer"></span>').append(refreshOnLoad, '</br>', classic_order)

    var FollowingObj = $('<div id="Following"/>');
    FollowingObj.append(button, optionsContainer, filtersToggle, filterBox, result);

    $('#right').append(FollowingObj);
    button.click();
},
Create: function () {
    $('#right').append('<div id="Create">' +
        '<dt>Title:</dt><input id="status" type="text" autocomplete="on"><br/>' +
        '<dt>Width:</dt><input id="width" type="text" autocomplete="on" placeholder="320"><br/>' +
        '<dt>Height:</dt><input id="height" type="text" autocomplete="on" placeholder="568"><br/>' +
        '<dt>Filename:</dt><input id="filename" type="text" autocomplete="on"><label><input id="camera" type="checkbox"> From camera</label><br/>' +
        '<dt>Streaming bitrate:</dt><input id="bitrate" type="text" value="200">kBps<br/>' +
        '<dt>Latitude:</dt><input id="lat" type="text" placeholder="0"><br/>' +
        '<dt>Longitude:</dt><input id="lon" type="text" placeholder="0"><br/>' +
        '<dt>Language:</dt><input id="cr_lang" type="text" value="'+(navigator.language || navigator.userLanguage || "en").substr(0, 2)+'"><br/>' +
        '<dt>Server:</dt><select id="server">' +
            '<option>us-west-1</option>' +
            '<option selected>eu-central-1</option>' +
        '</select><br/>' +
        '<br/><div style="clear: left;"><label><input id="friend_chat" type="checkbox"> Limit the chat to friends only</label></div><br/>' +
        '<br/></div>');
    $('#camera').click(function(){
        $('#filename').val(this.checked ? '/dev/video0' : '');
    });
    var createButton = $('<a class="button">Create</a>').click(function () {
        var widthInput = $('#width');
        var heightInput = $('#height');
        if (widthInput.val().trim() == '')
            widthInput.val(320);
        if (heightInput.val().trim() == '')
            heightInput.val(568);
        PeriscopeWrapper.V2_POST_Api('createBroadcast', {
            lat: +$('#lat').val() || 0,
            lng: +$('#lon').val() || 0,
            //supports_psp_version: [1, 0, 0],
            region: $('#server').val(),
            width: +widthInput.val(),
            height: +heightInput.val()
        }, function (createInfo) {
            PeriscopeWrapper.V2_POST_Api('publishBroadcast', {
                broadcast_id: createInfo.broadcast.id,
                friend_chat: $('#friend_chat')[0].checked,
                has_location: true,
                locale: $('#cr_lang').val(),
                lat: +$('#lat').val() || 0,
                lng: +$('#lon').val() || 0,
                status: $('#status').val().trim()
            }, function () {
                var filename = $('#filename').val();
                var input_options = ($('#camera')[0].checked ? '-f v4l2 -framerate 25 -video_size 640x480' : '') + ' -i "' + filename + '"';
                var code =
                    '#!/bin/bash\n' +
                    'FFOPTS="-vcodec libx264 -b:v ' + $('#bitrate').val() + 'k -profile:v main -level 2.1 -s ' + createInfo.broadcast.width + 'x' + createInfo.broadcast.height + ' -aspect ' + createInfo.broadcast.width + ':' + createInfo.broadcast.height + '"\n' +
                    'ffmpeg -loglevel quiet ' + input_options + ' $FFOPTS -vbsf h264_mp4toannexb -t 1 -an out.h264\n' + // converting to Annex B mode for getting right NALs
                    'SPROP=$(h264_analyze out.h264 2>&1 | grep -B 6 SPS | head -n1 | cut -c 4- | xxd -r -p | base64)","$(h264_analyze out.h264 2>&1 | grep -B 5 PPS | head -n1 | cut -c 4- | xxd -r -p | base64)\n' + // generating "sprop..."
                    'rm -f out.h264\n' +    // delete temp file
                    'ffmpeg ' + input_options + ' -r 1 -s ' + createInfo.broadcast.width + 'x' + createInfo.broadcast.height + ' -vframes 1 -y -f image2 orig.jpg\n' +
                    'curl -s -T orig.jpg -H "content-type:image/jpeg" "' + createInfo.thumbnail_upload_url + '"\n' +
                    'rm -f orig.jpg\n' +
                    'ffmpeg -re ' + input_options + ' $FFOPTS -metadata sprop-parameter-sets="$SPROP"' +
                    ' -strict experimental -acodec aac -b:a 128k -ar 44100 -ac 1 -f flv' +
                    ' rtmp://' + createInfo.host + ':' + createInfo.port + '/'+createInfo.application+'?t=' + createInfo.credential + '/' + createInfo.stream_name + ' < /dev/null &\n' +
                    'while true\n' +
                    ' do\n' +
                    '  echo -e "\\033[0;32m[My-OpenPeriscope] `curl -s --form "cookie=' + loginTwitter.cookie + '" --form "broadcast_id=' + createInfo.broadcast.id + '" https://api.periscope.tv/api/v2/pingBroadcast`\\033[0m"\n' +
                    '  sleep 20\n' +
                    ' done\n' +
                    'curl --form "cookie=' + loginTwitter.cookie + '" --form "broadcast_id=' + createInfo.broadcast.id + '" https://api.periscope.tv/api/v2/endBroadcast';
                var sh = 'stream_' + filename + '.sh';
                $('#Create').append('<pre>' + code + '</pre>',
                    $('<a href="data:text/plain;charset=utf-8,' + encodeURIComponent(code) + '" download="' + sh + '">Download .SH</a>').click(saveAs.bind(null, code, sh)),
                    $('<div class="card RUNNING"/>').append(getDescription(createInfo.broadcast)));
            });
            //var broadcast = response.broadcast;
        });
    });
    $('#Create').append(createButton);
},
Chat: function () {
    var broadcast_id = $('<input id="broadcast_id" type="text" size="15" placeholder="broadcast id">');
    var title = $('<span id="title"/>');
    var userlist = $('<div id="userlist"/>');
    var chat = $('<div id="chat"/>');
    var textBox = $('<input type="text" id="message">');
    var historyDiv = $('<div/>');
    if (NODEJS) {
        WebSocket = require('ws');
        $(window).on('unload', function(){
            if (ws)
                ws.close();
        });
    }

    function userlistAdd(user){
        var id = user.id || user.remoteID || user.user_id;
        if (!userlist.find('#'+id).length && (user.display_name || user.displayName)) {
            var userCard = $('<div class="user" id="' + id + '">' + emoji_to_img(user.display_name || user.displayName) + ' </div>')
                .append($('<div class="username">(' + user.username + ')</div>')
                .click(switchSection.bind(null, 'User', id)));
            addUserContextMenu(userCard, id, user.username);
            userlist.append(userCard);
        }
    }
    function userlistRemove(user){
        var id = user.id || user.remoteID || user.user_id;
        userlist.find('#'+id).remove();
    }
    function renderMessages(event, container) {
        if (event.occupants) {  // "presense" for websockets
            userlist.empty();
            var user;
            for (var j in event.occupants)
                if ((user = event.occupants[j]) && user.display_name) {
                    userlistAdd(user);
                }
        }
        else
        switch (event.type) {
            case 1:  // text message
                var date = new Date((parseInt(event.ntpForLiveFrame.toString(16).substr(0, 8), 16) - 2208988800) * 1000);
                if ($.isArray(container)) {   // for subtitles
                    // for (var i = 0; i < event.body.length; i++) // remove emoji surrogates
                    //     if (String.fromCodePoint(event.body.codePointAt(i)).length == 2) {
                    //         event.body = event.body.slice(0, i) + event.body.slice(i + 2);
                    //         i--;
                    //     }
                    container.push({
                        date: date,
                        user: event.username,
                        text: event.body
                    });
                } else {
                    var messageBox =$('<div class="messageBox"/>');
                    var profImage = $('<div style="background-image:url(' + (event.profile_image_url ? event.profile_image_url : event.profileImageURL) + ')" class="chatUserImg">').click(function () {
                        $(this).toggleClass("bigThumbnail");
                        $(this).next().children().first().toggleClass("hidename");
                    });
                    var messageTime = '<span class="messageTime">[' + zeros(date.getHours()) + ':' + zeros(date.getMinutes()) + ':' + zeros(date.getSeconds()) + '] </span>';
                    var display_name = $('<span class="displayName hidename">' + (event.locale ? getFlag(event.locale) : '') + ' ' + emoji_to_img(event.display_name || event.displayName || ' ') + '</span>').click(switchSection.bind(null, 'User', event.user_id));
                    var username = $('<span class="user">&lt;' + event.username + '&gt;</span>').click(function () { // insert username to text field
                        textBox.val(textBox.val() + '@' + $(this).text().substr(1, $(this).text().length - 2) + ' ');
                        textBox.focus();
                    });
                    var html = $('<div class="chatMessage"/>').append(display_name, ' ', username, ' ', messageTime, '</br>', '<span class="messageBody">'+ emoji_to_img($('<div/>').text(event.body).html()).replace(/(@\S+)/g, '<b>$1</b>')+'</span>');
                    messageBox.append(profImage,html);
                    if (!event.body)    // for debug
                        console.log('empty body!', event);
                    container.append(messageBox);
                }
                break;
            case 2: // heart
                /*moderationReportType: 0
                moderationType: 0*/
                break;
            case 3: // "joined"
                if (event.displayName && !$.isArray(container))
                    userlistAdd(event);
                break;
            case 4: // broadcaster moved to new place
                if ($('#debug')[0].checked && !$.isArray(container))
                    console.log('new location: ' + event.lat + ', ' + event.lng + ', ' + event.heading);
                break;
            case 5: // broadcast ended
                if (!$.isArray(container))
                    container.append('<div class="service">*** ' + (event.displayName || 'Broadcaster') + (event.username ? ' (@' + event.username + ')' : '') + ' ended the broadcast</div>');
                break;
            case 6: // followers invited
                if (!$.isArray(container))
                    container.append('<div class="service">*** ' + (event.displayName || '') + ' (@' + event.username + '): ' + event.body.replace('*%s*', event.invited_count) + '</div>');
                break;
            case 7: // BROADCAST_STARTED_LOCALLY (?)
                if (!$.isArray(container)) {
                    container.append('<div class="service">*** Broadcast started locally</div>');
                    console.log('BROADCAST_STARTED_LOCALLY', event);
                }
                break;
            case 8: // replay available
                break;
            case 9: // Broadcaster starts streaming. uuid=SE-0. timestampPlaybackOffset
                break;
            case 10: //LOCAL_PROMPT_TO_FOLLOW_BROADCASTER (?)
                if (!$.isArray(container)) {
                    container.append('<div class="service">*** LOCAL_PROMPT_TO_FOLLOW_BROADCASTER</div>');
                    console.log('LOCAL_PROMPT_TO_FOLLOW_BROADCASTER', event);
                }
                break;
            case 11: //LOCAL_PROMPT_TO_SHARE_BROADCAST (?)
                if (!$.isArray(container)) {
                    container.append('<div class="service">*** LOCAL_PROMPT_TO_SHARE_BROADCAST</div>');
                    console.log('LOCAL_PROMPT_TO_SHARE_BROADCAST', event);
                }
                break;
            case 12: // Ban
            case 14: //SUBSCRIBER_BLOCKED_VIEWER
                if ($.isArray(container))
                    container.push({
                        date: date,
                        user: '',
                        text: '@' + event.broadcasterBlockedUsername + ' has been blocked for message: "' + event.broadcasterBlockedMessageBody +'"'
                    });
                else
                container.append('<div class="service">*** @' + event.broadcasterBlockedUsername + ' has been blocked for message: "' + emoji_to_img(event.broadcasterBlockedMessageBody) + '"</div>');
                break;
            case 13: //SUBSCRIBER_SHARED_ON_TWITTER
                if (!$.isArray(container))
                    container.append('<div class="service">*** ' + (event.displayName || '') + ' (@' + event.username + ') shared on twitter</div>');
                break;
            case 15: //SUBSCRIBER_SHARED_ON_FACEBOOK
                if (!$.isArray(container))
                    container.append('<div class="service">*** ' + (event.displayName || '') + ' (@' + event.username + ') shared on facebook</div>');
                break;
            case 16: //SCREENSHOT
                if (!$.isArray(container))
                    container.append('<div class="service">*** ' + (event.displayName || '') + (event.username ? ' (@' + event.username + ')':'')+' has made the screenshot</div>');
                break;
            default: // service messages (event.action = join, leave, timeout, state_changed)
                if ($('#debug')[0].checked)
                    console.log('renderMessages default!', event);
                /*event.occupancy && event.total_participants*/
                break;
        }
    }
    function processWSmessage (message, div) {
        message.payload = JSON.parse(message.payload);
        message.body = $.extend(JSON.parse(message.payload.body), message.payload.sender);
        if ($('#autoscroll')[0].checked)
            chat[0].scrollTop = chat[0].scrollHeight;
        switch (message.kind) {
            case MESSAGE_KIND.CHAT:
                renderMessages(message.body, div);
                break;
            case MESSAGE_KIND.CONTROL:
                switch (message.payload.kind) {
                    case  MESSAGE_KIND.PRESENCE:
                        $('#presence').text(message.body.occupancy + '/' + message.body.total_participants);
                        break;
                    case MESSAGE_KIND.CHAT: // smb joined
                        userlistAdd(message.body); // message.payload.cap
                        break;
                    case MESSAGE_KIND.CONTROL: // smb left
                        userlistRemove(message.body); //message.payload.of
                        break;
                    default:
                        console.log(message);
                }
                break;
            default:
                console.log('default!', message);
        }
    }
    var playButton = $('<a class="button" id="startchat">OK</a>').click(function () {
        clearInterval(chat_interval);
        if (NODEJS && ws && ws.readyState == ws.OPEN)
            ws.close();
        chat.empty();
        userlist.empty();
        title.empty();
        historyDiv.empty();
         //Load user list
        PeriscopeWrapper.V2_POST_Api('getBroadcastViewers', {
            broadcast_id: broadcast_id.val().trim()
        }, function(viewers){
            userlist.empty();
            var user;
            for (var j in viewers.live)
                if ((user = viewers.live[j]) && user.display_name) {
                    userlistAdd(user);
                }
        });
        PeriscopeWrapper.V2_POST_Api('accessChannel', {
            broadcast_id: broadcast_id.val().trim()
        }, function (broadcast) {
            var userLink = $('<a class="username">(@' + broadcast.broadcast.username + ')</a>').click(switchSection.bind(null, 'User', broadcast.broadcast.user_id));
            var srtLink = $('<a>SRT</a>').click(function () {
                Progress.start();
                var data = [];
                historyLoad('', data, function(){
                    data.sort(function (a, b) { return a.date - b.date; });
                    var start = new Date(broadcast.broadcast.start);
                    var srt = '';
                    for (var i = 0; i < data.length; i++) {
                        var date0 = new Date(data[i].date - start); // date of the current message
                        var date1 = new Date((i < data.length - 1 ? data[i + 1].date : new Date(broadcast.broadcast.end || new Date())) - start); // date of the next message
                        srt += (i + 1) + '\n' +
                            zeros(date0.getUTCHours()) + ':' + zeros(date0.getMinutes()) + ':' + zeros(date0.getSeconds()) + ','+date0.getMilliseconds()+' --> ' +
                            zeros(date1.getUTCHours()) + ':' + zeros(date1.getMinutes()) + ':' + zeros(date1.getSeconds()) + ','+date1.getMilliseconds()+'\n' +
                            (i > 3 ? '<b>' + data[i - 4].user + '</b>: ' + data[i - 4].text + '\n' : '') +
                            (i > 2 ? '<b>' + data[i - 3].user + '</b>: ' + data[i - 3].text + '\n' : '') +
                            (i > 1 ? '<b>' + data[i - 2].user + '</b>: ' + data[i - 2].text + '\n' : '') +
                            (i > 0 ? '<b>' + data[i - 1].user + '</b>: ' + data[i - 1].text + '\n' : '') +
                            '<b>' + data[i].user + '</b>: ' + data[i].text + '\n\n';
                    }
                    var filename = (broadcast.broadcast.status || 'Untitled') + '.srt';
                    srtLink.unbind('click')
                        .click(saveAs.bind(null, srt, filename))
                        .attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(srt))
                        .attr('download', filename)
                        .get(0).click();
                });
            });
            title.html((broadcast.read_only?'Read-only | ':'') + '<a href="https://www.periscope.tv/w/' + broadcast.broadcast.id + '" target="_blank">' + emoji_to_img(broadcast.broadcast.status || 'Untitled') + '</a> | '
                + emoji_to_img(broadcast.broadcast.user_display_name) + ' ')
                .append(userLink,
                    broadcast.hls_url ? ' | <a href="' + broadcast.hls_url + '">M3U Link</a>' : '',
                    broadcast.replay_url ? ' | <a href="' + broadcast.replay_url + '">Replay Link</a>' : '',
                    broadcast.rtmp_url ? ' | <a href="' + broadcast.rtmp_url + '">RTMP Link</a>' : '',
                    ' | ', srtLink
                );
            // Load history
            function historyLoad(start, container, callback) {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: broadcast.endpoint + '/chatapi/v1/history',
                    data: JSON.stringify({
                        access_token: broadcast.access_token,
                        cursor: start,
                        duration: 100 // actually 40 is maximum
                    }),
                    onload: function (history) {
                        if (history.status == 200) {
                            history = JSON.parse(history.responseText);
                            for (var i in history.messages)
                                processWSmessage(history.messages[i], container || historyDiv);
                            if (history.cursor != '')
                                historyLoad(history.cursor, container, callback);
                            else {
                                Progress.stop();
                                if (Object.prototype.toString.call(callback) === '[object Function]')
                                    callback();
                            }
                        } else {
                            Progress.stop();
                            if (Object.prototype.toString.call(callback) === '[object Function]')
                                callback();
                        }
                    }
                });
            }
            chat.append(historyDiv, $('<center><a>Load history</a></center>').click(function () {
                Progress.start();
                historyLoad('');
                $(this).remove();
            }));
            if (broadcast.read_only)
                switch (broadcast.type) {
                    case "StreamTypeOnlyFriends":
                        chat.append('<div class="error">*** This chat is for friends only!</div>');
                        break;
                    default:
                        chat.append('<div class="error">*** Chatroom is full! You in read only mode!</div>');
                }
            // Chat reading & posting
            if (NODEJS) {
                var openSocket = function (failures) {
                    ws = new WebSocket(broadcast.endpoint.replace('https:', 'wss:').replace('http:', 'ws:') + '/chatapi/v1/chatnow');

                    ws.on('open', function open() {
                        // AUTH
                        ws.send(JSON.stringify({
                            payload: JSON.stringify({access_token: broadcast.access_token}),
                            kind: MESSAGE_KIND.AUTH
                        }));
                        // JOIN
                        ws.send(JSON.stringify({
                            payload: JSON.stringify({
                                body: JSON.stringify({
                                    room: broadcast.room_id
                                }),
                                kind: MESSAGE_KIND.CHAT
                            }),
                            kind: MESSAGE_KIND.CONTROL
                        }));
                    });

                    ws.on('ping', function (data) {
                        ws.pong(data, {masked: false, binary: true});
                    });

                    ws.on('message', function (data) {
                        processWSmessage(JSON.parse(data), chat);
                    });

                    ws.on('close', function (code) {
                        ws.close();
                        switch (code) {
                            case 403:   // 403=forbidden
                                console.log('Forbidden');
                                break;
                            case 1006:  // 1006=timeout
                                if (failures < 4) {
                                    setTimeout(openSocket.bind(null, failures + 1), 100);
                                    console.log('reconnect ' + failures);
                                }
                                break;
                            case 1000:  // 1000=broadcast ended
                                break;
                            default:
                                console.log('websocket closed, code: ', code);
                        }
                    });

                    ws.on('error', function () {});
                };

                function uuid() {//function from stackoverflow
                    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                        return v.toString(16);
                    });
                }

                var sendMessage = function (customtype) {
                    var timestamp = Math.floor(Date.now() / 1000);
                    var ntpstamp = parseInt((timestamp + 2208988800).toString(16) + '00000000', 16); // timestamp in NTP format
                    var message = {
                        body: textBox.val(),
                        //display_name: 'OpenPeriscope',
                        //initials: '',
                        //"moderationReportType": 0,
                        //"moderationType": 0,
                        //v: 2
                        profileImageURL: loginTwitter.user.profile_image_urls[0].url,
                        timestamp: timestamp,
                        remoteID: loginTwitter.user.id,
                        username: loginTwitter.user.username,
                        uuid: uuid(),// no longer identifie yourself as open periscope user on comment or heart.
                        signer_token: broadcast.signer_token,
                        participant_index: broadcast.participant_index,
                        type: customtype || 1,    // "text message"
                        ntpForBroadcasterFrame: ntpstamp,
                        ntpForLiveFrame: ntpstamp
                    };
                    ws.send(JSON.stringify({
                        payload: JSON.stringify({
                            body: JSON.stringify(message),
                            room: broadcast.room_id,
                            timestamp: timestamp
                            //sender
                        }),
                        kind: MESSAGE_KIND.CHAT
                    }), function (error) {
                        textBox.val('');
                        if (error)
                            console.log('message not sent', error);
                        else
                            renderMessages(message, chat);
                    });
                };
                if (broadcast.endpoint)
                    openSocket(0);
            } else {
                if (broadcast.endpoint) {
                    var cursor = null;
                    clearInterval(chat_interval);
                    var prevMessages = [];
                    chat_interval = setInterval(function () {
                        GM_xmlhttpRequest({
                            method: 'POST',
                            url: broadcast.endpoint + '/chatapi/v1/history',
                            data: JSON.stringify({
                                access_token: broadcast.access_token,
                                cursor: cursor || (Date.now() - 30000) * 1000000 + '',
                                limit: 1000
                            }),
                            onload: function (history) {
                                if (history.status == 200) {
                                    history = JSON.parse(history.responseText);
                                    for (var i in history.messages) {
                                        var contains = false;
                                        for (var j = 0; j < prevMessages.length && !contains; j++) // if prevMessages contains meesage
                                            if (prevMessages[j].signature == history.messages[i].signature)
                                                contains = true;
                                        if (!contains)
                                            processWSmessage(history.messages[i], chat);
                                    }
                                    prevMessages = history.messages;
                                    cursor = history.cursor;
                                }
                            }
                        });
                    }, 1000);
                }
                var sendMessage = function () {
                    alert('Sending messages available only in standalone version');
                };
            }
            $('#sendMessage').off().click(sendMessage.bind(null, null));
            $('#sendLike').off().click(sendMessage.bind(null, 2));
            textBox.off().keypress(function (e) {
                if (e.which == 13) {
                    sendMessage();
                    return false;
                }
            });
        }, function (error) {
            title.append('<b>' + error + '</b>');
        });
    });
    $('#right').append(
        $('<div id="Chat"/>').append(
            broadcast_id, playButton, title, '<br/><div id="presence" title="watching/maximum"/>', userlist, chat, $('<div id="underchat">').append(
                '<label class="right"><input type="checkbox" id="autoscroll" checked/> Autoscroll</label>',
                '<a class="button right" id="sendLike">\u2665</a><a class="button right" id="sendMessage">Send</a>', $('<div/>').append(textBox)
            )
        )
    );
},
User: function () {
    var resultUser = $('<div id="resultUser" />');
    var showButton = $('<a class="button" id="showuser">OK</a>').click(function () {
        resultUser.empty();
        var id =  $('#user_id').val().trim();
        var name =  $('#user_name').val().trim();
        name.startsWith('@') ? (name = name.slice('1',name.length)) : '';
        var param = {user_id : id};
        name ? param = {username : name} : '' ;
        PeriscopeWrapper.V2_POST_Api('user', param, function (response) {
            id = response.user.id;
            $('#user_id').val(id);
            resultUser.prepend(getUserDescription(response.user));
            FollowersSpoiler.append(' (' + response.user.n_followers + ')');
            FollowingSpoiler.append(' (' + response.user.n_following + ')');
            PeriscopeWrapper.V2_POST_Api('userBroadcasts', {
                user_id: id,
                all: true
            }, function (broadcasts) {
                refreshList($('#userBroadcasts'), null, "userBroadcasts")(broadcasts);
                BroadcastsSpoiler.append(' (' + broadcasts.length + ')').click();
            });
        },function(response){resultUser.prepend(response)});
        var BroadcastsSpoiler = $('<div class="spoiler menu" data-spoiler-link="broadcasts">Broadcasts</div>');
        var FollowersSpoiler = $('<div class="spoiler menu" data-spoiler-link="followers">Followers</div>').on("jq-spoiler-visible", function() {
            var followersDiv = $('#userFollowers');
            if (!followersDiv.html())
                PeriscopeWrapper.V2_POST_Api('followers', {
                    user_id: id
                }, function (followers) {
                    if (followers.length){
                        FollowersSpoiler.append(' (' + followers.length + ')');
                        for (var i in followers)
                            followersDiv.append($('<div class="card cardProfileImg"/>').append(getUserDescription(followers[i])));
                        }
                    else
                        followersDiv.html('No results');
                });
        });
        var FollowingSpoiler = $('<div class="spoiler menu" data-spoiler-link="following">Following</div>').on("jq-spoiler-visible", function() {
            var followingDiv = $('#userFollowing');
            if (!followingDiv.html())
                PeriscopeWrapper.V2_POST_Api('following', {
                    user_id: id
                }, function (following) {
                    if (following.length){
                        FollowingSpoiler.append(' (' + following.length + ')');
                        for (var i in following)
                            followingDiv.append($('<div class="card cardProfileImg"/>').append(getUserDescription(following[i])));
                        }
                    else
                        followingDiv.html('No results');
                });
        });
        resultUser.append(BroadcastsSpoiler, '<div class="spoiler-content" data-spoiler-link="broadcasts" id="userBroadcasts" />',
            FollowersSpoiler, '<div class="spoiler-content" data-spoiler-link="followers" id="userFollowers" />',
            FollowingSpoiler, '<div class="spoiler-content" data-spoiler-link="following" id="userFollowing" />');
        if (id == loginTwitter.user.id) {   // Blocked list
            var BlockedSpoiler = $('<div class="spoiler menu" data-spoiler-link="blocked">Blocked</div>').on("jq-spoiler-visible", function() {
                var blockedDiv = $('#userBlocked');
                if (!blockedDiv.html())
                    PeriscopeWrapper.V2_POST_Api('block/users', {}, function (blocked) {
                        if (blocked.length)
                            for (var i in blocked) {
                                blocked[i].is_blocked = true;
                                blockedDiv.append($('<div class="card cardProfileImg"/>').append(getUserDescription(blocked[i])));
                            }
                        else
                            blockedDiv.html('No results');
                    });
            });
            resultUser.append(BlockedSpoiler, '<div class="spoiler-content" data-spoiler-link="blocked" id="userBlocked" />');
        }
        $(".spoiler").off("click").spoiler({ triggerEvents: true });
    });
    var idInput = $('<div id="User">id: <input id="user_id" type="text" size="15" placeholder="user_id"><input id="user_name" type="text" size="15" placeholder="@username"></div>');
    $('#right').append(idInput.append(showButton, '<br/><br/>', resultUser));
},
People: function () {
    var refreshButton = $('<a class="button">Refresh</a>').click(function () {
        PeriscopeWrapper.V2_POST_Api('suggestedPeople', {
            languages: [$('#People .lang').val()]
        }, function (response) {
            var result = $('#resultPeople');
            result.empty();
            if (response.featured && response.featured.length) {
                result.append('<h1>Featured</h1>');
                for (var i in response.featured)
                    result.append($('<div class="card cardProfileImg"/>').append(getUserDescription(response.featured[i])));
            }
            result.append('<h1>Popular</h1>');
            for (i in response.popular)
                result.append($('<div class="card cardProfileImg"/>').append(getUserDescription(response.popular[i])));
            PeriscopeWrapper.V2_POST_Api('suggestedPeople', {}, function (response) {
                if (response.hearted && response.hearted.length) {
                    result.append('<h1>Hearted</h1>');
                    for (var i in response.hearted)
                        result.append($('<div class="card cardProfileImg"/>').append(getUserDescription(response.hearted[i])));
                }
            });
        });
    });
    var searchPeople = function () {
        PeriscopeWrapper.V2_POST_Api('userSearch', {
            search: $('#search').val()
        }, function (response) {
            var result = $('#resultPeople');
            result.html('<h1>Search results</h1>');
            var found_exact = false;
            for (var i in response) {
                result.append($('<div class="card cardProfileImg"/>').append(getUserDescription(response[i])));
                if (!found_exact && response[i].username.toUpperCase() == $('#search').val().toUpperCase())
                    found_exact=true;
            }
            if (!found_exact)
                PeriscopeWrapper.V2_POST_Api('user', {
                    username: $('#search').val()
                }, function (user) {
                    result.prepend($('<div class="card cardProfileImg"/>').append(getUserDescription(user.user)));
                });
        });
    };
    var searchButton = $('<a class="button">Search</a>').click(searchPeople);
    $('#right').append($('<div id="People"/>').append(languageSelect, refreshButton, $('<input id="search" type="text">').keypress(function (e) {
        if (e.which == 13) {
            searchPeople();
            return false;
        }
    }), searchButton, '<div id="resultPeople" />'));
    $("#People .lang").find(":contains(" + (navigator.language || navigator.userLanguage || "en").substr(0, 2) + ")").attr("selected", "selected");
    refreshButton.click();
},
Edit: function () {
    var button = $('<a class="button">Save</a>').click(function () {
        var uname = $('#uname').val();
        if (uname != loginTwitter.user.username) {
            PeriscopeWrapper.V2_POST_Api('verifyUsername', {
                username: uname,
                display_name: loginTwitter.user.display_name
            }, function () {
                loginTwitter.user.username = uname;
                localStorage.setItem('loginTwitter', JSON.stringify(loginTwitter));
            });
        }
        var description = $('#description').val();
        if (description != loginTwitter.user.description)
            PeriscopeWrapper.V2_POST_Api('updateDescription', {
                description: description
            }, function () {
                loginTwitter.user.description = description;
                localStorage.setItem('loginTwitter', JSON.stringify(loginTwitter));
            });
        var dname = $('#dname').val();
        if (dname != loginTwitter.user.display_name) {
            PeriscopeWrapper.V2_POST_Api('updateDisplayName', {
                display_name: dname
            }, function () {
                loginTwitter.user.display_name = dname;
                localStorage.setItem('loginTwitter', JSON.stringify(loginTwitter));
            });
        }
        if ($('input[name="image"]').val())
            form.submit();
    });
    var form = $('<form target="foravatar" action="https://api.periscope.tv/api/v2/uploadProfileImage" enctype="multipart/form-data" method="post">' +
        '<input name="image" type="file" accept="image/jpeg,image/png,image/gif">' +
        '<input name="cookie" type="hidden" value="'+loginTwitter.cookie+'"></form>');
    var hiddenIframe = $('<iframe id="foravatar" name="foravatar" style="display: none;"/>').on('load',refreshProfile);

    var settingsContainer = $('<div/>');
    var tempSettings;
    PeriscopeWrapper.V2_POST_Api('getSettings', {}, function (settingsResponse) {
        loginTwitter.settings = settingsResponse;
        localStorage.setItem('loginTwitter', JSON.stringify(loginTwitter));
        tempSettings = settingsResponse;
        for (var setting in loginTwitter.settings) {
            settingsContainer.append($('<label><input type="checkbox" ' + (loginTwitter.settings[setting] ? 'checked' : '') + '/> ' + setting + '</label><br/>').click(function (setting) {
                return function (e) {
                    tempSettings[setting] = e.target.checked;
                }
            }(setting)));
        }
    });
    var buttonSettings = $('<a class="button">Save</a>').click(function () {
        PeriscopeWrapper.V2_POST_Api('setSettings', {
            settings: tempSettings
        }, function (r) {
            if (r.success){
                loginTwitter.settings = tempSettings;
                localStorage.setItem('loginTwitter', JSON.stringify(loginTwitter));
            } else
                alert('Settings not saved!');
        });
    });

    var notifications = $('<label><input type="checkbox" ' + (settings.followingNotifications ? 'checked' : '') + '/> Enable notifications</label>').click(function (e) {
        setSet('followingNotifications', e.target.checked);
        if (e.target.checked)
            Notifications.start();
        else
            Notifications.stop();
    });
    var notifications_interval = $('<input type="number" min="2" value="' + (settings.followingInterval || Notifications.default_interval) + '">').change(function () {
        setSet('followingInterval', this.value);
        Notifications.stop();
        Notifications.start();
    });

    if (NODEJS) {
        var autoDownload = $('<label><input type="checkbox" ' + (settings.automaticDownload ? 'checked' : '') + '/> Enable automatic downloading of the following items</label>').click(function (e) {
            setSet('automaticDownload', e.target.checked);
            if (e.target.checked)
                Notifications.start();
            else
                Notifications.stop();
        });
        var download_private = $('<label><input type="checkbox" style="margin-left: 1.5em;" ' + (settings.privateDownload ? 'checked' : '') + '/> Private broadcasts</label>').click(function (e) {
            setSet('privateDownload', e.target.checked);
        });
        var download_following = $('<label><input type="checkbox" style="margin-left: 1.5em;"' + (settings.followingDownload ? 'checked' : '') + '/> Following broadcasts</label>').click(function (e) {
            setSet('followingDownload', e.target.checked);
        });
        var download_shared = $('<label><input type="checkbox" style="margin-left: 1.5em;"' + (settings.sharedDownload ? 'checked' : '') + '/> Shared broadcasts</label>').click(function (e) {
            setSet('sharedDownload', e.target.checked);
        });
        var download_Selected = $('<label><input type="checkbox" style="margin-left: 1.5em;"' + (settings.selectedDownload ? 'checked' : '') + '/> Selected users broadcasts</label>').click(function (e) {
            setSet('selectedDownload', e.target.checked);
        });
        var current_download_path = $('<dt style="margin-right: 10px;">' + settings.downloadPath + '</dt>');
        var download_path = $('<dt/>').append($('<input type="file" nwdirectory/>').change(function () {
            setSet('downloadPath', $(this).val());
            current_download_path.text($(this).val());
        }));
        // var download_format = $('<dt/>').append($('<select>' +
        //     '<option value="mp4" '+(settings.downloadFormat=='mp4'?'selected':'')+'>MP4</option>' +
        //     '<option value="ts" '+(settings.downloadFormat=='ts'?'selected':'')+'>TS</option>' +
        //     '</select>').change(function () {
        //     setSet('downloadFormat', $(this).val());
        // }));
        var log_broadcasts_to_file = $('<label><input type="checkbox" ' + (settings.logToFile ? 'checked' : '') + '/> Log broadcasts to a file</label>').click(function (e) {
            setSet('logToFile', e.target.checked);
        });
        var replay_time_limit = $('<input type="number" min="2" value="' + (settings.replayTimeLimit || Notifications.default_replay_limit) + '">').change(function () {
            setSet('replayTimeLimit', this.value);
        });
    }

    if (!NODEJS) {
        var show_nodeDown_links = $('<label><input type="checkbox" ' + (settings.showNodeDownLinks ? 'checked' : '') + '/> Show node periscopeDownloader links</label>').click(function (e) {
            setSet('showNodeDownLinks', e.target.checked);
        });
        var show_nodeDown_linksPrv = $('<label><input type="checkbox" style="margin-left: 1.5em;"' + (settings.showNodeDownLinksPrv ? 'checked' : '') + '/> Private broadcasts only</label>').click(function (e) {
            setSet('showNodeDownLinksPrv', e.target.checked);
        });
    }

    var show_m3u_links = $('<label><input type="checkbox" ' + (settings.showM3Ulinks ? 'checked' : '') + '/> Show M3U links</label>').click(function (e) {
        setSet('showM3Ulinks', e.target.checked);
    });
    var show_partial_links = $('<label><input type="checkbox" ' + (settings.showPRlinks ? 'checked' : '') + '/> Show partial replay(PR) links</label>').click(function (e) {
        setSet('showPRlinks', e.target.checked);
    });
    var update_thumbnails = $('<label><input type="checkbox" ' + (settings.updateThumbnails ? 'checked' : '') + '/> Auto update thumbnails</label>').click(function (e) {
        setSet('updateThumbnails', e.target.checked);
    });
    var open_preview_in_separate_windows = $('<label><input type="checkbox" ' + (settings.previewSeparateWindows ? 'checked' : '') + '/> Open previews in separate windows</label>').click(function (e) {
        setSet('previewSeparateWindows', e.target.checked);
    });

    var fileNameButton = $('<a class="button">Save</a>').click(function () {
        setSet('userPartialShort', $('#partialShort').val());
        setSet('userReplayShort', $('#replayShort').val());
        setSet('userPrivateShort', $('#privateShort').val());
        setSet('userProducerShort', $('#producerShort').val());
        setSet('userFolderName', $('#folderName').val());
        setSet('userFileName', $('#fileName').val());
    });
    var resetToDefault = $('<a class="button">Default</a>').click(function () {
        $('#partialShort').val(DefaultFolderFileNames.partialShort);
        $('#replayShort').val(DefaultFolderFileNames.replayShort);
        $('#privateShort').val(DefaultFolderFileNames.privateShort);
        $('#producerShort').val(DefaultFolderFileNames.producerShort);
        $('#folderName').val(DefaultFolderFileNames.folderName);
        $('#fileName').val(DefaultFolderFileNames.fileName);
    });

    var ProfileEditSpoiler = $('<h3 class="spoiler menu"  data-spoiler-link="ProfileEdit">Profile edit</h3>');
    var ProfileEdit = $('<div class="spoiler-content" data-spoiler-link="ProfileEdit" id="ProfileEdit" />')
        .append('<dt>Display name:</dt><input id="dname" type="text" value="' + loginTwitter.user.display_name + '"><br/>' +
            '<dt>Username:</dt><input id="uname" type="text" value="' + loginTwitter.user.username + '"><br/>' +
            '<dt>Description:</dt><input id="description" type="text" value="' + loginTwitter.user.description + '"><br/>' +
            '<dt>Avatar:</dt>', hiddenIframe, form, '<br/><br/>', button
        );
        
    var MyOpSettingsSpoiler = $('<h3 class="spoiler menu" data-spoiler-link="MyOpSettings">My-OpenPeriscope settings</h3>');
    var MyOpSettings = $('<div class="spoiler-content" data-spoiler-link="MyOpSettings" id="MyOpSettings" />')
        .append(notifications , '<br><br>',
            autoDownload, '<br>',
            download_private, '<br>',
            download_following, '<br>',
            download_shared, '<br>',
            download_Selected, '<br><br>',
            'Notifications refresh interval: ', notifications_interval ,' seconds','<br><br>',
            'Limit replay for auto-download: ', replay_time_limit,' seconds','<br>',
            (NODEJS ? ['<dt>Downloads path:</dt>', current_download_path, download_path, '<br><br><br>'] : ''),
            '<br>', log_broadcasts_to_file,
            '<br>', update_thumbnails,
            '<br>', open_preview_in_separate_windows,
            '<br>', show_m3u_links,
            '<br>', show_partial_links,
            '<br>', show_nodeDown_links,
            '<br>', show_nodeDown_linksPrv
        );

    var NamesEditorSpoiler = $('<h3 class="spoiler menu" data-spoiler-link="NamesEditor">Names editor</h3>');
    var NamesEditor =  $('<div class="spoiler-content" data-spoiler-link="NamesEditor" id="NamesEditor" />')
        .append(
            '<p>#{id}, #{language}, #{status}, #{user_display_name}, #{user_id}, #{username}, #{year}, #{month}, #{day}, #{hour}, #{minute}, #{second}</p></br>' +
            '<dt>#{partial}:</dt><input id="partialShort" type="text" value="' + (settings.userPartialShort || DefaultFolderFileNames.partialShort) + '"><br/>' +
            '<dt>#{replay}:</dt><input id="replayShort" type="text" value="' + (settings.userReplayShort || DefaultFolderFileNames.replayShort) + '"><br/>' +
            '<dt>#{private}:</dt><input id="privateShort" type="text" value="' + (settings.userPrivateShort || DefaultFolderFileNames.privateShort) + '"><br/>' +
            '<dt>#{producer}:</dt><input id="producerShort" type="text" value="' + (settings.userProducerShort || DefaultFolderFileNames.producerShort) + '"><br/>' +
            '<dt>Folder name:</dt><textarea id="folderName">' + (settings.userFolderName || DefaultFolderFileNames.folderName) + '</textarea><br/>' +
            '<dt>File name:</dt><textarea id="fileName">' + (settings.userFileName || DefaultFolderFileNames.fileName) + '</textarea><br/><br/>',
            fileNameButton , resetToDefault
        );

    var PeriSettingsSpoiler = $('<h3 class="spoiler menu"  data-spoiler-link="PeriSettings">Periscope settings</h3>');
    var PeriSettings = $('<div class="spoiler-content" data-spoiler-link="PeriSettings" id="PeriSettings" />').append(settingsContainer, "<br/>", buttonSettings);


    $('#right').append($('<div id="Edit"/>').append(
        ProfileEditSpoiler,  ProfileEdit,
        MyOpSettingsSpoiler, MyOpSettings,
        NamesEditorSpoiler, NamesEditor,
        PeriSettingsSpoiler, PeriSettings
    ));
    $(".spoiler").off("click").spoiler({ triggerEvents: true });
    MyOpSettingsSpoiler.click();
},
Dmanager: function (go_to_bid) {
    var result = $('<div/>');
    var refreshButton =  $('<a class="button">Refresh</a>').click(function () {dManagerDescription(result)});
    var removefinished = $('<a class="button">Remove Finished</a>').click(function () {
        if (childProcesses && childProcesses.length){
            childProcesses=childProcesses.filter(function(proc){
              return  proc.exitCode === null;
            })
            refreshButton.click();
        }
    });
    var goButton = $('<a class="button" id="downloadThis">Go</a>').click(function () {
        var dowLink = $('#broadcastLink').val().trim();
        var validLink = (dowLink.startsWith('https://www.periscope.tv/') || dowLink.startsWith('https://www.pscp.tv/'));
        if(validLink){
            var broadcast_id = dowLink.split('/')[4];
            var urlCallback = function(live, replay, cookies, _name, _folder_name, _broadcast_info) {
                var live_url = $('#right > div:visible >div').find('#templiveUrl');
                if(live){
                    live_url.val(live);
                    getURL(broadcast_id, urlCallback, true);
                }else if(replay){
                    download(_folder_name, _name, live_url.val(), replay, cookies, _broadcast_info);
                    live_url.val(null);
                }
            }
            getURL(broadcast_id, urlCallback);
            setTimeout(function(){refreshButton.click()},5000);
        }
    });
    var linkInput = $('<div id="downloadFrom" title="Download from link"><input id="broadcastLink" type="text" size="15" placeholder="https://www.pscp.tv/w/...">' + '<input id="templiveUrl" type="hidden"></div>').append(goButton);
    $('#right').append($('<div id="Dmanager"/>').append(refreshButton, removefinished,'</br>', linkInput, result));
    refreshButton.click();

    if(go_to_bid){
        var dowCards = $('.downloadCard.' + go_to_bid );
        setTimeout(function(){
            document.documentElement.scrollTop = 0;
            dowCards[0].scrollIntoView({behavior: 'smooth'});
            dowCards.addClass('focusedDownloadCard');
        },0);
    }
},
Console: function () {
    var resultConsole = $('<pre id="resultConsole" />');
    var downloadButton = $('<a class="button" id="download">Download</a>').click(function () {
        resultConsole.empty();
        var dl = download($('#download_folder_name').val().trim(), $('#download_name').val().trim(), $('#download_url').val().trim(), $('#download_replay_url').val().trim(), $('#download_cookies').val().trim(), JSON.parse($('#download_response').val().trim() || '""'), resultConsole);
        var gui = require('nw.gui');
        gui.Window.get().removeAllListeners('close').on('close', function(){
            try {
                dl.stdin.end('q', dl.kill);
            } finally {
                gui.App.quit();
            }
        });
    });
    $('#right').append($('<div id="Console"/>').append('<dt>URL:</dt><input id="download_url" type="text" size="45"><br/>' +
                                                       '<dt>R_URL:</dt><input id="download_replay_url" type="text" size="45"><br/>' +
                                                       '<dt>Cookies:</dt><input id="download_cookies" type="text" size="45"><br/>' +
                                                       '<dt>Name:</dt><input id="download_name" type="text" size="45"><br/>' +
                                                       '<dt>Folder:</dt><input id="download_folder_name" type="text" size="45"><br/>' +
                                                       '<dt>Key:</dt><input id="download_key" type="text" size="45"><br/>' +
                                                       '<input id="download_response" type="hidden">',
                                                        downloadButton, '<br/><br/>', resultConsole));
}
};
var chat_interval;
var ws; // websocket
var MESSAGE_KIND = {
    CHAT: 1,
    CONTROL: 2,
    AUTH: 3,
    PRESENCE: 4
};
/* LEVEL 1 */
function cleanFilename(filename){
    var tmp = filename.replace(/[<>+\\/:"|?*]/g, '');
    if (tmp.length > 100)
        tmp = tmp.substring(0, 98);
    if (tmp.endsWith('.'))
        tmp = tmp.replace(/\.$/, '_')
    return tmp;
}
function zeros(number) {
    return (100 + number + '').substr(1);
}

var broadcastsWithLinks = {
    idsQueue:[],
    addToBroadcastsLinks(id,params){
        if(this[id]){
            $.extend(true, this[id], params);
        }else{
            this[id] = params;
        }
    }
};

function addUserContextMenu(node, id, username) {
    node.contextmenu(function (ev) {
        ev.preventDefault();
        var contextmenu = $('<div class="contextmenu" style="top: ' + ev.pageY + 'px; left: ' + ev.pageX + 'px;"/>')
            .append($('<div>Follow</div>').click(function () {
                PeriscopeWrapper.V2_POST_Api('follow', {
                    user_id: id
                });
            }))
            .append($('<div>Unfollow</div>').click(function () {
                PeriscopeWrapper.V2_POST_Api('unfollow', {
                    user_id: id
                });
            }))
            .append('<div data-clipboard-text="https://periscope.tv/' + username + '">Copy profile URL</div>' +
                    '<div data-clipboard-text="' + username + '">Copy username</div>' +
                    '<div data-clipboard-text="' + id + '">Copy user ID</div>')
            .append($('<div>Block user</div>').click(function () {
                PeriscopeWrapper.V2_POST_Api('block/add', {
                    to: id
                });
            }))
            .append($('<div>Unlock user</div>').click(function () {
                PeriscopeWrapper.V2_POST_Api('block/remove', {
                    to: id
                });
            }))
            .append($('<div>Profile on Periscope</div>').click(function(){
                var win = window.open(
                    "https://periscope.tv/" + username, 
                    "PeriscopeProfile" + (settings.previewSeparateWindows?username:''), 
                    "toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=800,height=550,top=100,left="+(screen.width/2));
            }))
            .click(function (event) {
                $(this).remove();
            })
            .mousedown(function (event) {
                event.stopPropagation();
            });
        $(document.body).append(contextmenu).off('mousedown').mousedown(function () {
            contextmenu.remove();
        });
        new ClipboardJS('.contextmenu div');
    })
};

broadcastsCache = {
    idsQueue: [],
    oldBroadcastsList: [],
    interestingList: [],
    autoGettinList: [],
    filters:{
        hideProducer: false,
        hideEnded: false,
        languages:{
            Arabic: 'ar',
            Armenian: 'hy',
            Chinese: 'zh',
            Danish: 'da',
            English: ['en','us'],
            Finnish: 'fi',
            French: 'fr',
            German: 'de',
            Hebrew: 'he',
            Indonesian: 'id',
            Italian: 'it',
            Japanese: 'ja',
            Kazakh: 'kk',
            Korean: 'ko',
            Norwegian: 'nb',
            Polish: 'pl',
            Portuguese: 'pt',
            Romanian: 'ro',
            Russian: 'ru',
            Spanish: 'es',
            Swedish: 'sv',
            Turkish: 'tr',
            Ukrainian: 'uk',
            other: 'other'
        },
        languagesToHide: []
    }
}

function refreshList(jcontainer, title, refreshFrom) {  // use it as callback arg
    return function (response) {
        jcontainer.html(title || '<div style="clear:both"/>');
        if (response.length) {
            var ids = [];

            var createCard = function (index) {
                var resp;
                if (refreshFrom === 'following' && !settings.classic_cards_order){
                    var deleted = existingBroadcasts.indexOf(broadcastsCache.idsQueue[index]) < 0;
                    resp = broadcastsCache[broadcastsCache.idsQueue[index]];
                } else {
                    resp = response[index];
                }

                deleted ? resp.state = 'ENDED' : ''; //prevent some cached broadcasts from showing as running.
                var isPrivate = resp.is_locked;
                var producer = (resp.broadcast_source === 'producer' || resp.broadcast_source === 'livecms');
                var newHighlight = (broadcastsCache.oldBroadcastsList.indexOf(resp.id) < 0 && refreshFrom === 'following' && broadcastsCache.oldBroadcastsList.length !== 0) ? ' newHighlight' : '';
                var stream = $('<div class="card ' + resp.state + ' ' + resp.id + newHighlight + (deleted ? ' deletedBroadcast' : '') 
                            + (isPrivate ? ' private' : '') + (producer? ' producer ' : '') + '" nr="' + index + '"' + ' lang="' + resp.language + '"/>').append(getDescription(resp));
                if (refreshFrom != "userBroadcasts")
                    addUserContextMenu(stream, resp.user_id, resp.username);

                var link = $('<a class="downloadGet"> Get stream link </a>');
                link.click(getM3U.bind(null, resp.id, stream));

                let recLink = $('<span class="recContainer"/>').append(downloadStatus(resp.id, true));

                var downloadWhole = $('<a class="downloadWhole"> Download </a>').click(getBothURLs.bind(null, resp.id));

                if (refreshFrom === 'following' ){
                    var repeat_getTheLink = (settings.showPRlinks && resp.state === 'RUNNING')? ($('<label><input type="checkbox"' + ((broadcastsCache.autoGettinList.indexOf(resp.id) >= 0) ? 'checked' : '') + '/> repeat</label>').click({param1: resp.id},function (e) {
                        if(e.target.checked) {
                            broadcastsCache.autoGettinList.push(e.data.param1);
                        }else{
                            broadcastsCache.autoGettinList.splice(broadcastsCache.autoGettinList.indexOf(e.data.param1),1);
                        }
                        broadcastsCache.interestingList.indexOf(e.data.param1) < 0 ? broadcastsCache.interestingList.push(e.data.param1) : '';
                        if(broadcastsCache.interestingList.length > 100)
                            broadcastsCache.interestingList.shift();
                    })) : '';

                    broadcastsCache.filters.hideEnded && !newHighlight && (resp.state != 'RUNNING') ? stream.hide() : '';
                }

                broadcastsCache.filters.hideProducer && !newHighlight && producer ? stream.hide() : '';
                broadcastsCache.filters.languagesToHide.indexOf(resp.language) >= 0 ? stream.hide() : '';

                ids.push(resp.id);
                var replayLinkExists = false;
                 if (broadcastsWithLinks.hasOwnProperty(resp.id) ){
                        var brwlID = broadcastsWithLinks[resp.id];
                        var rep = brwlID.RclipboardLink;
                        var repM3U = brwlID.Rm3uLink;
                        var liv = brwlID.clipboardLink;
                        var showDowLink = !NODEJS && (settings.showNodeDownLinks || (settings.showNodeDownLinksPrv && isPrivate)) && settings.showPRlinks;
                        rep ? replayLinkExists = brwlID.RdownloadLink.hasClass('linkReplay') : '';

                        if(liv && !replayLinkExists){
                            var clipboardLink = brwlID.clipboardLink.clone();
                            new ClipboardJS(clipboardLink.get(0));
                            var clipboardDowLink = brwlID.clipboardDowLink.clone();
                            new ClipboardJS(clipboardDowLink.get(0));

                            stream.find('.responseLinks').append(
                            (settings.showM3Ulinks && brwlID.m3uLink) ? [brwlID.m3uLink.clone(), ' | '] : '',
                                NODEJS ? [brwlID.downloadLink.clone(true,true), ' | '] : '',
                                clipboardLink,
                                showDowLink ? [' | ', clipboardDowLink] : '', '<br/>'
                            );
                        }
                        if(rep){
                            var RclipboardLink = brwlID.RclipboardLink.clone();
                            new ClipboardJS(RclipboardLink.get(0));
                            var RclipboardDowLink = brwlID.RclipboardDowLink.clone();
                            new ClipboardJS(RclipboardDowLink.get(0));

                            stream.find('.responseLinksReplay').append(
                            (settings.showM3Ulinks && settings.showPRlinks && repM3U) ? [repM3U.clone(true,true), ' | '] : '',
                            (settings.showPRlinks && NODEJS ? [brwlID.RdownloadLink.clone(true,true), ' | '] : ''),
                             settings.showPRlinks ? RclipboardLink : '',
                             showDowLink ? [' | ', RclipboardDowLink] : '', '<br/>'
                            );
                        }
                    }
                    var addMethod = '';
                    refreshFrom === 'following' && !settings.classic_cards_order ? addMethod = 'prepend' : '';
                    refreshFrom !== 'following' || settings.classic_cards_order ? addMethod = 'append' : '';
                    jcontainer[addMethod](stream.append(recLink, ((NODEJS && !replayLinkExists)? [downloadWhole, ' | '] : ''), link).append((refreshFrom === 'following') ? repeat_getTheLink : ''));
                }

            if (refreshFrom === 'following'){
                var existingBroadcasts = [];
                var interestingToggle = false;
                var interestingList = [];

                for (var o in response) {
                    existingBroadcasts.push(response[o].id);
                }
                for (var i = response.length - 1; i >= 0; i--) {
                    broadcastsCache[response[i].id] = response[i];
                    limitAddIDs(broadcastsCache, response[i].id, 100, existingBroadcasts);
                }
                if (settings.classic_cards_order){
                    for (var i in response){
                        createCard(i)
                    }
                } else {
                    for (var i = broadcastsCache.idsQueue.length - 1; i >= 0; i--)
                        createCard(i)
                }

                broadcastsCache.oldBroadcastsList = [];
                for (var x in broadcastsCache.idsQueue) {
                    broadcastsCache.oldBroadcastsList.push(broadcastsCache.idsQueue[x]);
                }

                jcontainer.prepend($('<br/><a class="watching right icon">Show interesting only</a><br/>').click(function () {
                    var cards = jcontainer.find('.card');
                    $.each(cards, function(i){
                        for(var a in broadcastsCache.interestingList){
                            if($(cards[i]).hasClass(broadcastsCache.interestingList[a])){
                                $(cards[i]).addClass('interesting');
                            break;
                            }
                        }
                    })
                    if(!interestingToggle){
                        interestingToggle = true;
                        cards.filter(":visible").each(function(index, card){
                            interestingList.push(card.getAttribute('nr'))
                        })
                        cards.not(".interesting").hide();
                        $(".interesting").show();
                    }else{
                        interestingToggle = false;
                        $(".interesting").hide();
                        cards.filter(function(i, card){
                            return (interestingList.indexOf(card.getAttribute('nr')) >= 0)
                        }).show()
                        interestingList = [];
                    }
                    $(window).trigger('scroll');    // for lazy load
                }));
            } else { //if not following tab
                for (var i in response)
                    createCard(i)
            }

            var sortedAlready = false;
            jcontainer.prepend($('<a class="watching right icon">Sort by watching</a>').click(function () {  // sort cards in given jquery-container
                var cards = jcontainer.find('.card');
                if(!sortedAlready){
                    var sorted = cards.sort(function (a, b) {
                        return $(b).find('.watching').text() - $(a).find('.watching').text();
                    });
                    sortedAlready = true;
                }else{
                    var sorted = cards.sort(function (a, b) {
                        return $(a)[0].getAttribute('nr') - $(b)[0].getAttribute('nr');
                    });
                    sortedAlready = false;
                }
                jcontainer.append(sorted);
                $(window).trigger('scroll');    // for lazy load
            }));

            if (typeof response[0].n_watching == 'undefined')
                PeriscopeWrapper.V2_POST_Api('getBroadcasts', {
                    broadcast_ids: ids,
                    only_public_publish: true
                }, function (info) {
                    for (var i in info)
                        $('.card.' + info[i].id + ' .watching').text(info[i].n_watching);
                });
        } else
            jcontainer.append('No results');
        // if jcontainer isn't visible, scroll to it
        var top = jcontainer.offset().top;
        if ($(window).scrollTop() + $(window).height() - 100 < top) {
            $(window).scrollTop(top);
        }
    };
}
function limitAddIDs(toObject, whatID, howMany, inResponse){
    if(toObject.idsQueue.indexOf(whatID) === -1)
            toObject.idsQueue.unshift(whatID);
    var len = toObject.idsQueue.length;
    if(len > howMany){ //to keep catched broadcasts under (howMany) remove first card from bottom that holds deleted broadcast
        for(var i = len - 1; i >= 0; i--){
            if(inResponse.indexOf(toObject.idsQueue[i]) < 0){//if broadcast(id) is on oryginal following list then don't delete it.
                delete toObject[toObject.idsQueue[i]]
                toObject.idsQueue.splice(i,1)
                return;
            }//TODO, list can get bigger than 'howMany'/low priority fix
        }
    }
}

function linkRedirection301(replay_url, callback){
    var downloader_cookies = 'sid=' + loginTwitter.cookie + ';';
    GM_xmlhttpRequest({
        method: 'GET',
        url: replay_url,
        headers: {
            'User-Agent': 'Periscope/2699 (iPhone; iOS 8.1.2; Scale/2.00)',
            'cookie': downloader_cookies
        },
        onload: function (res) {
            replay_url = res.finalUrl;
            if (replay_url){//not "not found"
            callback(replay_url, downloader_cookies);
            }
        }
    });
}

function saveDecryptionKey(_url, id, cookies, got_M3U_playlist, mainCallback){
    got_M3U_playlist ? request(_url, getKey, 'arraybuffer') : request(_url, getKeyUri);
    cookies ? '': cookies = '';
    function request(url, callback, respType) {
        GM_xmlhttpRequest({
            responseType : respType,
            method: 'GET',
            url: url,
            headers: {
                Cookie: cookies
            },
            onload: function (response) {
                if (response.status == 200) {
                    NODEJS ? callback(response.responseArray) : callback(response.responseText); 
                }else{
                    mainCallback? mainCallback(true):'';//tell function to not attach links because obtaining key has failed
                }
            }
        })
    }

    function getKeyUri(m3u_text) { // extract key uri from playlist
        NODEJS ? m3u_text = m3u_text.join('') : '';
        var keyURI = m3u_text.split('\n').filter(function (line) {
                return /(^#EXT-X-KEY:.+)/g.test(line);
            });
            if (!keyURI[0])// broadcast starts but has o chunks AND key uri on the playlist
                return; //TODO retry after 10s or so
            keyURI = keyURI[0].split('"')[1];
            request(keyURI, getKey, 'arraybuffer');
    }

    function getKey(respKey){
        NODEJS ? respKey = respKey[0] : '';
        var base = new Uint8Array(respKey);
        var base64key = btoa(String.fromCharCode.apply(null, base));

        limitAddIDs(broadcastsWithLinks, id, 200, []);
        broadcastsWithLinks.addToBroadcastsLinks(id,{decryptKey : base64key})
        mainCallback? mainCallback():'';
    }
}

function getBothURLs(id) {
    var live_url = '';
    var urlCallback = function (hls_url, replay_url, cookies, _name, _folder_name, _broadcast_info, _partial_replay) {
        broadcastsCache.interestingList.indexOf(id) < 0 ? broadcastsCache.interestingList.push(id) : '';
        if(broadcastsCache.interestingList.length > 100){
            broadcastsCache.interestingList.shift();
        }
        if(hls_url){
            live_url = hls_url;
            getURL(id, urlCallback, true, true);
        }else if(replay_url){
            switchSection('Console', {url: live_url, rurl: replay_url, cookies: cookies, name: _name, folder_name: _folder_name, broadcast_info: _broadcast_info});
        }else if(hls_url === null && replay_url === null && liveUrl) { //when live just started and no partial replay available
            switchSection('Console', {url: live_url, rurl: '', cookies: cookies, name: _name, folder_name: _folder_name, broadcast_info: _broadcast_info});
        }
    }
    getURL(id, urlCallback);
}
function getM3U(id, jcontainer) {
    var liveLContainer = jcontainer.find('.responseLinks');
    var replayLContainer = jcontainer.find('.responseLinksReplay');
    liveLContainer.addClass('oldLinks');
    replayLContainer.addClass('oldLinks');
    broadcastsCache.interestingList.indexOf(id) < 0 ? broadcastsCache.interestingList.push(id) : '';
    if(broadcastsCache.interestingList.length > 100){
        broadcastsCache.interestingList.shift();
    }
    var urlCallback = function (hls_url, replay_url, cookies, _name, _folder_name, _broadcast_info, _partial_replay) {
        !_partial_replay ? (liveLContainer.removeClass('oldLinks'), liveLContainer.children().length ? liveLContainer.empty() : '') : '';
        (_partial_replay || replay_url) ? (replayLContainer.removeClass('oldLinks'), replayLContainer.children().length ?  replayLContainer.empty() : '') : '';

        var locked = _broadcast_info.is_locked;
        limitAddIDs(broadcastsWithLinks, id, 200, []);
        if (hls_url) {
            var clipboardLink = $('<a data-clipboard-text="' + hls_url + '" class="linkLive button2" title="Copy live broadcast URL">Copy URL</a>');
            var clipboardDowLink = $('<a data-clipboard-text="' + 'node periscopeDownloader.js ' + '&quot;' + hls_url + '&quot;' + ' ' + '&quot;' + (_name || 'untitled') + '&quot;' +( locked ? (' ' + '&quot;' + cookies + '&quot;') : '') + '" class="linkLive button2">NodeDown</a>');
            var downloadLink = $('<a class="linkLive button2" title="Record live broadcast">Record</a>')
            .click(switchSection.bind(null, 'Console', {url: hls_url, rurl: '', cookies: cookies, name: _name, folder_name: _folder_name, broadcast_info: _broadcast_info}));
            liveLContainer.append(
                settings.showM3Ulinks ? '<a href="' + hls_url + '">Live M3U link</a>' : '', settings.showM3Ulinks ? ' | ' : '',
                NODEJS ? [downloadLink, ' | ' ]: '',
                clipboardLink,
                ((!NODEJS && (settings.showNodeDownLinks || (settings.showNodeDownLinksPrv && _broadcast_info.is_locked))) ? [' | ' ,clipboardDowLink] : ''), '<br/>'
            );
            new ClipboardJS(clipboardLink.get(0));
            new ClipboardJS(clipboardDowLink.get(0));

            var linksObj = {
                m3uLink : $('<a href="' + hls_url + '">Live M3U link</a>'),
                downloadLink : downloadLink.clone(true,true),
                clipboardLink : clipboardLink.clone(),
                clipboardDowLink : clipboardDowLink.clone()
            }
            broadcastsWithLinks.addToBroadcastsLinks(id,linksObj)

            settings.showPRlinks ? getURL(id, urlCallback, true) : '';
        }else if (replay_url){
            var replay_base_url = replay_url.replace(/([^\/]+)\.m3u8.+/ig, '');
            GM_xmlhttpRequest({
                method: 'GET',
                url: replay_url,
                headers: {
                    Cookie: cookies
                },
                onload: function (m3u_text) {
                    m3u_text = m3u_text.responseText.replace(/(^[^#][^\s].*)/gm, replay_base_url + '$1');
                    var link = $('<a href="data:text/plain;charset=utf-8,' + encodeURIComponent(m3u_text) + '" download="playlist.m3u8">Download' + (_partial_replay ? ' PR ' : ' replay ' ) + 'M3U</a>').click(saveAs.bind(null, m3u_text, 'playlist.m3u8'));
                    var clipboardLink = $('<a data-clipboard-text="' + replay_url + '" class="button2 ' + (_partial_replay ? 'linkPartialReplay' : 'linkReplay') + '" title="' + (_partial_replay ? 'Copy partial replay URL' : 'Copy replay URL') +'">' + (_partial_replay ? 'Copy PR_URL' : 'Copy R_URL') + '</a>');
                    var clipboardDowLink = $('<a data-clipboard-text="' + 'node periscopeDownloader.js ' + '&quot;' + replay_url + '&quot;' + ' ' + '&quot;' + (_name || 'untitled') + '&quot;' + (locked ? (' ' + '&quot;' + cookies + '&quot;') : '') + '" class="' + (_partial_replay ? 'linkPartialReplay' : 'linkReplay') + ' button2">' + (_partial_replay ? 'PR_NodeDown' : 'R_NodeDown') + '</a>');
                    var downloadLink = $('<a class="' + (_partial_replay ? 'linkPartialReplay' : 'linkReplay') + ' button2" title="' + (_partial_replay ? 'Download partial replay' : 'Download replay') + '">' +(_partial_replay ? 'Download PR' : 'Download' ) + '</a>')
                    .click(switchSection.bind(null, 'Console', {url: '', rurl: replay_url, cookies: cookies, name: _name, folder_name: _folder_name, broadcast_info: _broadcast_info}));
                    
                    replayLContainer.append(
                        settings.showM3Ulinks ? [link,  ' | '] : '',
                        NODEJS ? [downloadLink.clone(true,true), ' | '] : '',
                        clipboardLink,
                        ((!NODEJS && (settings.showNodeDownLinks || (settings.showNodeDownLinksPrv && locked))) ? [' | ' ,clipboardDowLink] : ''), '<br/>'
                    );
                    new ClipboardJS(clipboardLink.get(0));
                    new ClipboardJS(clipboardDowLink.get(0));

                    var repLinksObj = {
                        Rm3uLink : link,
                        RdownloadLink : downloadLink.clone(true,true),
                        RclipboardLink : clipboardLink.clone(),
                        RclipboardDowLink : clipboardDowLink.clone()
                    }

                    if(broadcastsWithLinks[id]){
                        $.extend(true, broadcastsWithLinks[id], repLinksObj);
                    }else{
                        broadcastsWithLinks[id] = repLinksObj;
                    }

                    if (locked && !broadcastsWithLinks[id].hasOwnProperty('decryptKey') && m3u_text){
                            var keyURI = m3u_text.split('\n').filter(function (line) {
                                return /(^#EXT-X-KEY:.+)/g.test(line);
                            });
                            keyURI = keyURI[0].split('"')[1];
                            saveDecryptionKey(keyURI, id, cookies, true);
                    }
                }
            });
        }
    }
    getURL(id, urlCallback);
}
/**
 * @callback getURLCallback
 * @param {String} hls_url
 * @param {String} replay_url
 * @param {Array} cookies
 * @param {String} name
 * @param {String} user_id
 * @param {String} user_name
 * @param {Object} broadcast
 * @param {Boolean} partialReplay
 * 
 */

/**
 *
 * @param {String} id - broadcast ID
 * @param {getURLCallback} callback - function applied against result
 */
function getURL(id, callback, partialReplay, whole){
    var getURLCallback = function (r) {
        var privateBroadacast = r.broadcast.is_locked === true;
        var producer = (r.broadcast_source === 'producer' || r.broadcast_source === 'livecms');
        var name = userFolderFileName(settings.userFileName || DefaultFolderFileNames.fileName, r.broadcast, partialReplay, !!r.replay_url, producer, whole);
        var folder_name = userFolderFileName(settings.userFolderName || DefaultFolderFileNames.folderName, r.broadcast, partialReplay, !!r.replay_url, producer, whole);
        // var cookies = r.cookies;
        var cookies = '';
        privateBroadacast ? cookies = ('sid=' + loginTwitter.cookie + ';') : '';
        
        // For live
        var hls_url = r.hls_url || r.https_hls_url || r.lhls_url;
        if (hls_url) {
            callback(hls_url, null, cookies, name, folder_name, r.broadcast);
        }

        // For replay
        var replay_url = r.replay_url
        if(replay_url && !replay_url.endsWith('?type=replay') ){ // 301 redirection For private replay and some rare non private.
            linkRedirection301(replay_url, ifReplay)
        }else if (replay_url){
            ifReplay(replay_url, '');
        }

        function ifReplay(replay_Url, cookies){
            if (replay_Url) {
                callback(null, replay_Url, cookies, name, folder_name, r.broadcast, partialReplay);
            }
        }
        //for no live no replay(when requested partial replay does not exist)
        if(!hls_url && !replay_url)
            callback(null, null, cookies, name, folder_name, r.broadcast);
    };

    var ApiParameters ={
        broadcast_id: id,
    };
    partialReplay ? ( ApiParameters.replay_redirect = false, ApiParameters.latest_replay_playlist = true) : '';
    (function a(ApiParameters){//private replays correctly attach to their card.
        PeriscopeWrapper.V2_POST_Api('accessVideoPublic', ApiParameters, getURLCallback, function(){
            PeriscopeWrapper.V2_POST_Api('accessChannel', ApiParameters, getURLCallback) // private video case
        });
    })(ApiParameters)
}

DefaultFolderFileNames = {
    partialShort: 'P',
    replayShort: 'R_',
    privateShort: 'PV_',
    producerShort: 'PRO_',
    folderName: '#{user_id} (#{username})',
    fileName: '#{private}#{partial}#{replay}#{year}-#{month}-#{day}_#{hour}.#{minute}_#{user_display_name}_#{status}'
}

function userFolderFileName(userString, b_info, partialReplay, replay, producer, whole){
    var date_created = new Date(b_info.start);

    b_info.year = date_created.getFullYear();
    b_info.month = zeros(date_created.getMonth() + 1);
    b_info.day = zeros(date_created.getDate());
    b_info.hour = zeros(date_created.getHours());
    b_info.minute = zeros(date_created.getMinutes());
    b_info.second = zeros(date_created.getSeconds());
    (partialReplay && !whole) ? (b_info.partial = (settings.userPartialShort || DefaultFolderFileNames.partialShort)) : '';
    (replay && !whole) ? (b_info.replay = (settings.userReplayShort || DefaultFolderFileNames.replayShort)) : '';
    b_info.is_locked ? (b_info.private = (settings.userPrivateShort || DefaultFolderFileNames.privateShort)) : '';
    producer ?  (b_info.replay = (settings.userProducerShort || DefaultFolderFileNames.producerShort)) : '';

    return userString.replace(/(\#|\$){[a-z_]+}/gi, function(param){
        return (b_info[param.slice(2,-1)] !== undefined) ? (param = b_info[param.slice(2,-1)]) : '';
    });
}

function download(folder_name ,name, url, rurl, cookies, broadcast_info, jcontainer, replayLimit) { // cookies=['key=val','key=val']
    function _arrayBufferToString(buf, callback) {
        var bb = new Blob([new Uint8Array(buf)]);
        var f = new FileReader();
        f.onload = function (e) {
            callback(e.target.result);
        };
        f.readAsText(bb);
    }

    var windows = process.platform === 'win32',
        folder_separator = windows ? '\\' : '/';

    var output_dir = settings.downloadPath + folder_separator

    if (folder_name)
        output_dir += cleanFilename(folder_name) + folder_separator;

    const fs = require('fs');
    try {
        fs.mkdirSync(output_dir);
    } catch (e) {}
    
    name = cleanFilename(name || 'untitled')

    output_name_check(0);

    var otherProcessHasName = function (nameToCheck) {
        return childProcesses.some(function (child) {
            return child.file_name === nameToCheck;
        });
    }
    function output_name_check(num) {
        fs.stat(output_dir + name + (num ? num : '') + '.ts', function (err, stats) {
            if (stats || otherProcessHasName(name + (num ? num : ''))) {
                output_name_check(num + 1);
            } else {
                num ? name = name + num : '';
                var decryption_key;
                if (broadcastsWithLinks[broadcast_info.id] && broadcastsWithLinks[broadcast_info.id].hasOwnProperty('decryptKey')){ // if broadcast has decryption key saved
                    decryption_key = broadcastsWithLinks[broadcast_info.id].decryptKey;
                    $('#download_key').val(decryption_key);
                }
                
                const spawn = require('child_process').spawn(process.execPath, [
                    'downloaderNode.js',
                    '-url', url,
                    '-rurl', rurl,
                    '-dir', output_dir,
                    '-name', name,
                    '-cookies', cookies,
                    '-key', decryption_key,
                    '-limit', replayLimit === true ? settings.replayTimeLimit : ''
                ],{
                    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
                });

                spawn.b_info = broadcast_info;
                spawn.folder_path = output_dir;
                spawn.file_name = name;
                childProcesses.push(spawn);
                if(childProcesses.length > 100){
                    childProcesses.shift()
                }
                $(document).find('.card.' + broadcast_info.id).find('.recContainer').empty().append(downloadStatus(broadcast_info.id, true));

                if (jcontainer) {
                    if (!spawn.pid)
                        jcontainer.append('FFMpeg not found. On Windows, place the static build into OpenPeriscope directory.');
                    spawn.stdout.on('data', function (data) {
                        _arrayBufferToString(data, function (d) {
                            jcontainer.append(d);
                        });
                    });
            
                    spawn.stderr.on('data', function (data) {
                        _arrayBufferToString(data, function (d) {
                            jcontainer.append(d);
                        });
                    });

                    spawn.on('error', function (code) {
                        _arrayBufferToString(code, function (d) {
                            console.log('error: ', d);
                        });
                    });
                    
                    // $(window).keydown(function(event){
                    //     spawn.stdin.write(String.fromCharCode(event.keyCode)+'\r\n');
                    //     //spawn.stdin.close();
                    // });
                } else {
                    if (spawn.pid) {
                        ffLog = "";
                        function writeToLog(data) {
                            _arrayBufferToString(data, function (d) {
                                ffLog += d;
                            });
                        }
                        spawn.stdout.on('data', writeToLog);
                        spawn.stderr.on('data', writeToLog);
                        spawn.on('close', function (code, signal) {
                            ffLog+="\nClose: code "+code+", signal "+signal;
                        });
                        spawn.on('error', writeToLog.bind("disconnected"));
                        spawn.on('disconnect', writeToLog);
                        spawn.on('exit', function (code, signal) {
                            ffLog+="\nExit: code "+code+", signal "+signal;
                        });
                    }
                }
                return spawn;
            }
        });
    }

}
function saveAs(data, filename) {
    if (NODEJS) {
        $('<input type="file" nwsaveas="' + filename + '" />')/* .change(function () {
            const fs = require('fs');
            fs.writeFile($(this).val(), data);
        }).click(); */
    }
}
function getFlag(country) {
    var a = ['en','zh','ar','uk','ja','kk','da','da','he','ko','nb','sv'];//language code
    var b = ['gb','cn','sa','ua','jp','kz','dk','dk','il','kr','no','se'];//country flag code
    var langIndex = a.indexOf(country);
    (langIndex >= 0) ? country = b[langIndex] : '';
    var flagOffset = 127365;
    var both = String.fromCodePoint(country.codePointAt(0) + flagOffset) + String.fromCodePoint(country.codePointAt(1) + flagOffset);
    var output = emoji.replace_unified(both);
    return (output === both) ? country : output;
};
function loadScreenPreviewer(stream, thumbs) {
    var win = window.open("", "screenPreviewer" + (settings.previewSeparateWindows?stream.id:''), "toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=800,height=550,top=100,left="+(screen.width/2));
    var title = '<title>'+(stream.status || 'Untitled')+' [My-OpenPeriscope]</title>';
    var html = '<style type="text/css">.hideImages{display: none;}#screenPreviewer{height: 90%; position: absolute;left: 50% ;transform: translateX(-50%); -webkit-transform: translateX(-50%); border: 1px solid gray} body{background: #2A2A2A} a{color: white; display: block}</style>'
        +'<a href="#" id="button">Switch to screenlist</a><div id="screenPreviewer"></div>';
    for (var i in thumbs.chunks) {
        html+='<img src="' + thumbs.chunks[i].tn + '"/>';
    }
    html+='<script>\
    setTimeout(function () {\
        var images = document.querySelectorAll("img");\
        var widowWidth = (0.9 * window.innerWidth) || 720;\
        var bg = document.getElementById("screenPreviewer");\
        var lastI = 0;\
        var button = document.getElementById("button");\
        button.onclick = function () {\
            bg.style.width = widowWidth;\
            bg.style.display == "block" ? bg.style.display = "none" : bg.style.display = "block";\
            for (var j = 0, len = images.length; j < len; j++)\
            images[j].className == "hideImages" ? (images[j].className = "") : (images[j].className = "hideImages");\
            var i = 0;\
            bg.onmousemove = function (event) {\
                i = Math.floor(event.offsetX / (widowWidth / len));\
                if (i >= len) i = len;\
                if (i < 1) i = 0;\
                if (i != lastI) {\
                    if (images[i].complete)\
                    bg.style.background = "url(" + images[i].src + ") no-repeat center /contain";\
                    lastI = i;\
                }\
            }\
        }\
    }, 100);\
    setTimeout(function () {\
        button.click();\
    }, 200);\
    </script>';
    win.document.body.innerHTML = '';
    win.document.write(title,html);

}
function getDescription(stream) {
    var title = emoji_to_img(stream.status || 'Untitled');
    var featured_reason = '';
    if (stream.featured) {
        title += '<span class="featured" style="background: ' + (stream.featured_category_color || '#FFBD00') + '">' + (stream.featured_category || 'POPULAR') + '</span>';
        if (stream.featured_reason)
            featured_reason = ' <i>'+stream.featured_reason+'</i>';
    }
    var date_created = new Date(stream.created_at);
    var duration = stream.end || stream.timedout ? new Date(new Date(stream.end || stream.timedout) - (new Date(stream.start))) : 0;
    var userLink = $('<a class="username">' + emoji_to_img(stream.user_display_name) + ' (@' + stream.username + ')</a>');
    userLink.click(switchSection.bind(null, 'User', stream.user_id));
    if (stream.share_display_names) {
        var sharedByLink = $('<a class="sharedByUsername">'+ emoji_to_img(stream.share_display_names[0]) + '</a>')
            .click(switchSection.bind(null, 'User', stream.share_user_ids[0]));
    }
    if (stream.user_id == loginTwitter.user.id)
        var deleteLink = $('<a class="delete right icon" title="Delete"/>').click(function () {
            PeriscopeWrapper.V2_POST_Api('deleteBroadcast', {broadcast_id: stream.id}, function (resp) {
                if (resp.success)
                    description.parent().remove();
            });
        });
    var screenlistLink = $('<a class="screenlist right icon">Preview</a>').click(function () {
        PeriscopeWrapper.V2_POST_Api('replayThumbnailPlaylist', {
            broadcast_id: stream.id
        }, function (thumbs) {
            loadScreenPreviewer(stream, thumbs);
        });
    });

    var brdcstImage = $('<img lazysrc="' + stream.image_url_small + '"></img>').one('error',function(){this.src = stream.image_url});
    var showImage = $('<a class="lastestImage"></a>').click(function () {
        var win = window.open("", "screen", "toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=600,height=600,top=100,left="+(screen.width/2));
        win.document.head.innerHTML = '<title>'+(stream.status || 'Untitled')+' [My-OpenPeriscope]</title><style type="text/css">body{background: #2A2A2A}</style>';
        win.document.body.innerHTML = '<img src="' + stream.image_url + '"/>';
    }).append(brdcstImage, (stream.is_locked ? '<img src="' + IMG_PATH + '/images/lock-white.png" class="lock"/>' : '') 
    + ((stream.broadcast_source === 'producer' || stream.broadcast_source === 'livecms') ? '<span class="sProducer">Producer</span>': ''));
    var watchingTitle=('<div class="watching right icon" title="Watching">' + (stream.n_total_watching || stream.n_web_watching || stream.n_watching || stream.n_total_watched || 0) + '</div>\
    <a target="_blank" href="https://www.periscope.tv/w/' + stream.id + '" class="broadcastTitle">' + title + '</a>'+featured_reason)
    var chatLink = $('<a class="chatlink right icon">Chat</a>').click(switchSection.bind(null, 'Chat', stream.id));
    var description = $('<div class="description"></div>')
        .append(showImage, watchingTitle, deleteLink, '<br/>', screenlistLink, userLink, (sharedByLink ? [', shared by ', sharedByLink] : ''), (stream.channel_name ? ', on: ' + emoji_to_img(stream.channel_name) : ''), '<br/>', chatLink,
            '<span class="date icon" title="Created">' + zeros(date_created.getDate()) + '.' + zeros(date_created.getMonth() + 1) + '.' + date_created.getFullYear() + ' ' + zeros(date_created.getHours()) + ':' + zeros(date_created.getMinutes()) + '</span>'
            + (duration ? '<span class="time icon" title="Duration">' + zeros(duration.getUTCHours()) + ':' + zeros(duration.getMinutes()) + ':' + zeros(duration.getSeconds()) + '</span>' : '')
            + (stream.friend_chat ? '<span class="friend_chat" title="Chat only for friends"/>' : '')
            + (stream.is_locked ? '<span class="is_locked" title="Locked"/>' : ''),
            '<br/><span class="lang right" title="Language ' + stream.language + '">' + getFlag(stream.language) + '</span>',
            (stream.has_location ? $('<span style="cursor:pointer;">' + stream.country + ', ' + stream.city + '</span>').click(switchSection.bind(null, 'Map', stream.ip_lat + ',' + stream.ip_lng)) : ''), '<div class="links"><div class="responseLinks"/><div class="responseLinksReplay"/></div>');
    return description[0];
}
function getUserDescription(user) {
    user.profile_image_urls.sort(function (a, b) {
        return a.width * a.height - b.width * b.height;
    });
    var verified_icon = user.is_twitter_verified ? ' <svg class="right" title="Verified" viewBox="0 0 17 17" height="1em" version="1.1"><g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"><g transform="translate(-767.000000, -573.000000)"><g transform="translate(-80.000000, -57.000000)"><g transform="translate(100.000000, 77.000000)"><g transform="translate(400.000000, 401.000000)"><g><g><g transform="translate(347.000000, 152.000000)"><path d="M1.74035847,11.2810213 C1.61434984,11.617947 1.54545455,11.982746 1.54545455,12.3636364 C1.54545455,14.0706983 2.92930168,15.4545455 4.63636364,15.4545455 C5.01725401,15.4545455 5.38205302,15.3856502 5.71897873,15.2596415 C6.22025271,16.2899361 7.2772042,17 8.5,17 C9.7227958,17 10.7797473,16.2899361 11.2810213,15.2596415 L11.2810213,15.2596415 C11.617947,15.3856502 11.982746,15.4545455 12.3636364,15.4545455 C14.0706983,15.4545455 15.4545455,14.0706983 15.4545455,12.3636364 C15.4545455,11.982746 15.3856502,11.617947 15.2596415,11.2810213 C16.2899361,10.7797473 17,9.7227958 17,8.5 C17,7.2772042 16.2899361,6.22025271 15.2596415,5.71897873 C15.3856502,5.38205302 15.4545455,5.01725401 15.4545455,4.63636364 C15.4545455,2.92930168 14.0706983,1.54545455 12.3636364,1.54545455 C11.982746,1.54545455 11.617947,1.61434984 11.2810213,1.74035847 C10.7797473,0.71006389 9.7227958,0 8.5,0 C7.2772042,0 6.22025272,0.71006389 5.71897873,1.74035847 C5.38205302,1.61434984 5.01725401,1.54545455 4.63636364,1.54545455 C2.92930168,1.54545455 1.54545455,2.92930168 1.54545455,4.63636364 C1.54545455,5.01725401 1.61434984,5.38205302 1.74035847,5.71897873 C0.71006389,6.22025272 0,7.2772042 0,8.5 C0,9.7227958 0.71006389,10.7797473 1.74035847,11.2810213 L1.74035847,11.2810213 Z" opacity="1" fill="#88C9F9"></path><path d="M11.2963464,5.28945679 L6.24739023,10.2894568 L7.63289664,10.2685106 L5.68185283,8.44985845 C5.27786241,8.07328153 4.64508754,8.09550457 4.26851062,8.499495 C3.8919337,8.90348543 3.91415674,9.53626029 4.31814717,9.91283721 L6.26919097,11.7314894 C6.66180802,12.0974647 7.27332289,12.0882198 7.65469737,11.7105432 L12.7036536,6.71054321 C13.0960757,6.32192607 13.0991603,5.68876861 12.7105432,5.29634643 C12.3219261,4.90392425 11.6887686,4.90083965 11.2963464,5.28945679 L11.2963464,5.28945679 Z" fill="#FFFFFF"></path></g></g></g></g></g></g></g></g></svg>' : '';
    return $('<div class="description"/>')
    .append((user.profile_image_urls.length ? '<a href="' + (user.profile_image_urls[0].url.includes("googleusercontent.com/") ? user.profile_image_urls[0].url.replace("s96-c", "s0") : user.profile_image_urls[user.profile_image_urls.length - 1].url) + '" target="_blank"><img class="avatar" width="128" lazysrc="' + user.profile_image_urls[0].url + '"></a>' : '<img class="avatar" width="128"/>')
    + '<div class="watching right icon" title="Followers">' + user.n_followers + '</div>'
    + (user.n_hearts ? '<div class="hearts right icon" title="hearts">' + user.n_hearts + '</div>' : '')
    + (user.twitter_screen_name ? '<a class="twitterlink right icon" title="Profile on Twitter" target="_blank" href="https://twitter.com/' + user.twitter_screen_name + '"><svg viewBox="0 0 16 14" height="1em" version="1.2"><g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"><g transform="translate(-187.000000, -349.000000)" fill="#A4B8BE"><g transform="translate(187.000000, 349.000000)"><path d="M16,2.19685162 C15.4113025,2.4579292 14.7786532,2.63438042 14.1146348,2.71373958 C14.7924065,2.30746283 15.3128644,1.66416205 15.5579648,0.897667303 C14.9237353,1.27380396 14.2212078,1.5469961 13.4734994,1.69424362 C12.8746772,1.05626857 12.0215663,0.6576 11.0774498,0.6576 C9.26453784,0.6576 7.79475475,2.12732457 7.79475475,3.94011948 C7.79475475,4.19739297 7.8238414,4.44793615 7.87979078,4.68817903 C5.15161491,4.55129033 2.73285782,3.24443931 1.11383738,1.25847055 C0.83128132,1.74328711 0.669402685,2.30717021 0.669402685,2.90874306 C0.669402685,4.04757037 1.24897034,5.05231817 2.12976334,5.64095711 C1.591631,5.62392649 1.08551154,5.4762693 0.642891108,5.23040808 C0.64265701,5.2441028 0.64265701,5.25785604 0.64265701,5.27166782 C0.64265701,6.86212833 1.77416877,8.18887766 3.27584769,8.49039564 C3.00037309,8.56542399 2.71038443,8.60551324 2.41097333,8.60551324 C2.19946596,8.60551324 1.99381104,8.58497115 1.79342331,8.54663764 C2.21111233,9.85079653 3.42338783,10.7998291 4.85981199,10.8263406 C3.7363766,11.706724 2.32096273,12.2315127 0.783057171,12.2315127 C0.518116976,12.2315127 0.256805296,12.2160037 0,12.1856881 C1.45269395,13.1170462 3.17817038,13.6604458 5.0319324,13.6604458 C11.0697831,13.6604458 14.3714986,8.65853639 14.3714986,4.32076252 C14.3714986,4.17843105 14.3683383,4.0368604 14.3620176,3.89610909 C15.0033286,3.43329772 15.5598961,2.85513466 16,2.19685162" id="Fill-1" sketch:type="MSShapeGroup"></path></g></g></g></svg></a>' : '')
    + '<a class="periscopelink right icon" title="Profile on Periscope" target="_blank" href="https://periscope.tv/' + user.username + '"><svg version="1.1" height="1em" viewBox="0 0 113.583 145.426"><g><path fill="#A4B8BE" class="tofill" d="M113.583,56.791c0,42.229-45.414,88.635-56.791,88.635C45.416,145.426,0,99.02,0,56.791	C0,25.426,25.426,0,56.792,0C88.159,0,113.583,25.426,113.583,56.791z"/><path fill="#FFFFFF" d="M56.792,22.521c-2.731,0-5.384,0.327-7.931,0.928c4.619,2.265,7.807,6.998,7.807,12.489	c0,7.686-6.231,13.917-13.917,13.917c-7.399,0-13.433-5.779-13.874-13.067c-4.112,5.675-6.543,12.647-6.543,20.191	c0,19.031,15.427,34.458,34.458,34.458S91.25,76.01,91.25,56.979S75.823,22.521,56.792,22.521z"/></g></svg></a>')
    .append($('<div class="username">' + verified_icon + emoji_to_img(user.display_name) + ' (@' + user.username + ')</div>').click(switchSection.bind(null, 'User', user.id)))
    .append('Created: ' + (new Date(user.created_at)).toLocaleString()
    + (user.description ? '<div class="userdescription">' + emoji_to_img(user.description) +'</div>': '<br/>'))
    .append($('<a class="button' + (user.is_following ? ' activated' : '') + '">' + (user.is_following ? 'unfollow' : 'follow') + '</a>').click(function () {
        var el = this;
        var selectButton=$(el).next().next()
        PeriscopeWrapper.V2_POST_Api(el.innerHTML, { // follow or unfollow
            user_id: user.id
        }, function (r) {
            if (r.success) {
                if (el.innerHTML == 'follow') {
                    el.innerHTML = 'unfollow';
                    $(el).addClass('activated');
                } else {
                    el.innerHTML = 'follow';
                    $(el).removeClass('activated');
                    selectButton.text() == '-' ? selectButton.click() : '';
                }
            }
        })
    }))
    .append($('<a class="button">' + (user.is_blocked ? 'unblock' : 'block') + '</a>').click(function () {
        var el = this;
        PeriscopeWrapper.V2_POST_Api(el.innerHTML == 'block' ? 'block/add' : 'block/remove', {
            to: user.id
            }, function (r) {
                if (r.success)
                el.innerHTML = el.innerHTML == 'block' ? 'unblock' : 'block';
            })
    }))
    .append(NODEJS ? ($('<a class="button' + (selectedDownloadList.includes(user.id) ? ' activated' : '') + '" title="Select/Deselect User">' + (selectedDownloadList.includes(user.id) ? '-' : '+') + '</a>').click(function () {
        var el = this;
        var followButton = $(el).prev().prev()
        if (el.innerHTML == '+') {
            el.innerHTML = '-';
            $(el).addClass('activated');
            followButton.text() == 'follow' ? followButton.click() : '';
        } else {
            el.innerHTML = '+';
            $(el).removeClass('activated');
        }

        var isStoredAt = selectedDownloadList.indexOf(user.id)
        if (isStoredAt === 0){
            selectedDownloadList="";
            localStorage.setItem(('selectedUsersDownloadList'), selectedDownloadList)
        }else if (isStoredAt > 0) {
            selectedDownloadList = selectedDownloadList.substr(0, isStoredAt - 1) + selectedDownloadList.substr(isStoredAt + user.id.length)
            localStorage.setItem(('selectedUsersDownloadList'), selectedDownloadList)
        } else {
            selectedDownloadList += user.id + ','
            localStorage.setItem(('selectedUsersDownloadList'), selectedDownloadList)
        }    
    })) : '')
    .append('<div style="clear:both"/>');
}

function dManagerDescription(jcontainer) {
    jcontainer.html('<div style="clear:both"/>');
    debug = $('#debug').length && $('#debug')[0].checked;
    if (childProcesses.length) {
        for (var i = childProcesses.length - 1; i >= 0; i--) {
            (function () { //IIFE to keep each iteration
                var CProcess = childProcesses[i];
                var broadcastInfo = CProcess.b_info;
                var filePath = CProcess.folder_path;
                var brdcstImage = $('<img src="' + broadcastInfo.image_url_small + '"></img>').one('error',function(){this.src = broadcastInfo.profile_image_url, $(this).addClass('avatar')});
                var dManager_username = $('<span class="username">' + emoji_to_img(broadcastInfo.user_display_name || "undefined") + ' (@' + broadcastInfo.username + ')</span>').click(switchSection.bind(null, 'User', broadcastInfo.user_id));
                
                var brdcstTitle = $('<a class="b_title">' + emoji_to_img(broadcastInfo.status || CProcess.file_name) + '<a>').click(function () {
                    require('fs').stat(filePath, function (err, stats) {
                        if (err) {} else {
                            if (process.platform === 'win32') {
                                require('child_process').exec('"' + filePath + CProcess.file_name + '.ts"', function () {}); //open video
                            } else {
                                require('child_process').exec('xdg-open ' + "'" + filePath + CProcess.file_name + ".ts'", function () {});//open video on linux
                            }
                        }
                    });
                });

                let stopButton = $('<a class="button right">Stop</a>').click(function () {
                    try {
                        CProcess.stdin.end('q', /* CProcess.kill */);
                    }catch(e){}
                });

                var openFolderButton = $('<a class="button right">folder</a>').click(function () {
                    var self = $(this);
                    require('fs').stat(filePath, function (err, stats) {
                        if (err) { // Directory doesn't exist or something.
                            if (err.code === 'ENOENT') {
                                self.html("doesn't exist");
                            } else {
                                self.html("error");
                                console.error(err);
                            }
                        } else {
                                gui.Shell.showItemInFolder(filePath + CProcess.file_name +'.ts');
                        }
                    });
                });

                var dManagerExitStatus = $('<span class="dManagerExitStatus">').append(downloadStatus(broadcastInfo.id, false));
                var dManagerMessages = $('<div class="dManagerMessages">' + (CProcess.lastMessage ? CProcess.lastMessage : '') + '</div>');
                var dManagerTimer = $('<span class="dManagerTimer">' + (CProcess.lastUptime ? CProcess.lastUptime : '') + '</span>');
                CProcess.removeAllListeners('message', function () {}) //to avoid multiple listeners, +1 at each refresh
                CProcess.on('message', function (msg) {
                    if (typeof msg === 'string') {
                        var msgPrefix = msg.split(' ')[0];
                    }
                    if ((msgPrefix === 'Error' || msgPrefix === 'Warning') || ((typeof msg) === 'object')) {
                        if (typeof CProcess.errorsLog === 'undefined') {
                            CProcess.errorsLog = [];
                            CProcess.errorsLog.push(msg);
                        } else {
                            CProcess.errorsLog.push(msg);
                        }
                    }
                    if (msgPrefix === 'Uptime:') {
                        dManagerTimer.html(msg);
                        CProcess.lastUptime = msg;
                    } else if (typeof msg === 'string') {
                        dManagerMessages.html(msg);
                        CProcess.lastMessage = msg; //preserve last message from spawned process between refreshes
                    }
                });
                let broadcast_id = broadcastInfo.id;
                CProcess.on('exit', function () {
                        stopButton.remove();
                        dManagerExitStatus.empty().append(downloadStatus(broadcast_id, false));
                        $(document).find('.card.' + broadcast_id).not('.downloadCard, .cardProfileImg').find('.recContainer').empty().append(downloadStatus(broadcast_id, true));
                });
                var messagesContainer = $('<div class="downloaderContainer" style="font-size: 16px; color: gray; margin: 5px"></div>').append(dManagerExitStatus, dManagerTimer, dManagerMessages);

                var errButton = $('<a class="button right errbutton">Show errors</a>').click(function () {
                    console.log(CProcess.errorsLog);
                });

                var downloadCard = $('<div class="card downloadCard ' + broadcastInfo.id + '"/>').append( $('<div class="description"></div>').append((CProcess.exitCode === null ? stopButton : ''), openFolderButton,
                    ((CProcess.errorsLog && debug) ? errButton : ''), brdcstImage, brdcstTitle, '<br/>', dManager_username, '<br/>', messagesContainer
                ));
            
                jcontainer.append(downloadCard);
            })()
        }

        var downloadsCount = $('<span class="downloadingCounter"></a>').append(function () {
            var addedDownloads = childProcesses.filter(function (x) {
                return x.exitCode === null;
            }).length;
            return addedDownloads + ' in progress, ' + (childProcesses.length - addedDownloads) + ' finished';
        });

        jcontainer.prepend('<br/>', downloadsCount);
    } else
        jcontainer.append('No results');
    return jcontainer;
}

function downloadStatus(broadcast_id, link){
    cpIndex = childProcesses.findIndex(function(cProcess) {return cProcess.b_info.id === broadcast_id;});
    if (cpIndex >= 0){
        let title = 'Recording/Downloading';
        let emote = '🔴';
        let eCode = childProcesses[cpIndex].exitCode;
        if (link) {childProcesses.some(function(cProcess){ return (cProcess.b_info.id === broadcast_id && cProcess.exitCode === null)}) ? (eCode = null) : ''}; //if any process still downloading then show as downloading.
        if (eCode === 0) title = 'Downloaded', emote = '✅';
        if (eCode === 1) title = 'Stopped', emote = '❎';
        if (eCode > 1) title = 'error', emote = '❌';
        if(link){
            let recLink = [$('<a title="' + title + '" class="downloadStatus">' + emoji_to_img(emote) + '</a>').click(
                switchSection.bind(null,'Dmanager', broadcast_id)
            ), ' | '];
            return recLink;
        }else{
            let exitEmote = '<span title="' + title + (eCode > 1 ? (' exit code:' + eCode): '') + '" class="downloadStatus">' + emoji_to_img(emote) + '</span>';
            return exitEmote;
        }
    };
    return '';
}

function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();
    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    return [year, month, day].join('-')  + ' ' +  date.toLocaleTimeString();
}

function emoji_to_img(textInput){
    if(ifEmoji('🐸')){
        return textInput;
    } else{
        return emoji.replace_unified(textInput)// for browsers/systems without emojis support
    }
}
function setSet(key, value) {
    settings[key] = value;
    localStorage.setItem('settings', JSON.stringify(settings));
}
function clearXHR() {   // abort all running XHR requests
    for (var i in XHR) {
        Progress.stop();
        XHR[i].abort();
    }
    XHR=[];
}
/* LEVEL 0 */
var XHR = [];
function SignIn3(session_key, session_secret) {
    PeriscopeWrapper.V2_POST_Api('loginTwitter', {
        "session_key": session_key,
        "session_secret": session_secret
    }, function (response) {
        localStorage.setItem('loginTwitter', JSON.stringify(response));
        loginTwitter = response;
        Ready(loginTwitter);
        if (!loginTwitter.user.username)    // User registration
            PeriscopeWrapper.V2_POST_Api('verifyUsername', {
                username: loginTwitter.suggested_username,
                display_name: loginTwitter.user.display_name
            }, function (verified) {
                if (verified.success) {
                    loginTwitter.user = verified.user;
                    localStorage.setItem('loginTwitter', JSON.stringify(loginTwitter));
                } else
                    console.log('User verification failed!', verified);
            });
    })
}
function SignIn2(oauth_token, oauth_verifier) {
    OAuthTwitter('access_token', function (oauth) {
        localStorage.setItem('session_key', oauth.oauth_token);
        localStorage.setItem('session_secret', oauth.oauth_token_secret);
        session_key = oauth.oauth_token;
        session_secret = oauth.oauth_token_secret;
        SignIn3(session_key, session_secret);
    }, {oauth_token: oauth_token, oauth_verifier: oauth_verifier});
}
function SignIn1() {
    setSet('consumer_secret', $('#secret').val());
    if (settings.consumer_secret) {
        $(this).text('Loading...');
        OAuthTwitter('request_token', function (oauth) {
            location.href = 'https://api.twitter.com/oauth/authorize?oauth_token=' + oauth.oauth_token;
        }, {oauth_callback: 'twittersdk://openperiscope/index.html'});
    }
}
function SignOut() {
    localStorage.clear();
    setSet();
    location.pathname = 'index.html';
}
function OAuthTwitter(endpoint, callback, extra){
    OAuth('https://api.twitter.com/oauth/' + endpoint, 'POST', callback,extra);
}
function OAuth(endpoint, _method, callback, extra) {
    var method = _method || 'POST';
    var url = endpoint;
    var params = {
        oauth_consumer_key: '9I4iINIyd0R01qEPEwT9IC6RE',
        oauth_nonce: Date.now(),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Date.now() / 1000 | 0,
        oauth_version: '1.0'
    };
    for (var i in extra)
        params[i] = extra[i];

    var signatureBase = [];
    var keys = Object.keys(params).sort();
    for (i in keys)
        signatureBase.push(keys[i] + '=' + params[keys[i]]);

    var signatureBaseString = method + '&' + encodeURIComponent(url) + '&' + encodeURIComponent(signatureBase.join('&'));

    params.oauth_signature = encodeURIComponent(
        CryptoJS.enc.Base64.stringify(
            CryptoJS.HmacSHA1(signatureBaseString, settings.consumer_secret + '&' + (session_secret || ''))
        )
    );

    var params_prepared = [];
    for (i in params) {
        params_prepared.push(i + '="' + params[i] + '"');
    }
    GM_xmlhttpRequest({
        method: method,
        url: url,
        headers: {
            Authorization: 'OAuth ' + params_prepared.join(', ')
        },
        onload: function (r) {
            if (r.status == 200) {
                var oauth = {};
                var response = r.responseText.split('&');
                for (var i in response) {
                    var kv = response[i].split('=');
                    oauth[kv[0]] = kv[1];
                }
                callback(oauth);
            }
            else if (r.status == 401) {   // old tokens: reload page
                console.log('oauth error 401: ' + r.responseText);
                SignOut();
            }
            else
                console.log('oauth error: ' + r.status + ' ' + r.responseText);
        }
    });
}

function SignInSMS() {
    setSet('consumer_secret', $('#secret').val());
    if (settings.consumer_secret) {
        OAuthDigits('oauth2/token', {
            form: {
                grant_type: 'client_credentials'
            },
            token_type: 'Basic',
            access_token: btoa('9I4iINIyd0R01qEPEwT9IC6RE:' + settings.consumer_secret)
        }, function (response_token) {
            OAuthDigits('1.1/guest/activate.json', {
                token_type: response_token.token_type,
                access_token: response_token.access_token
            }, function (response_activate) {
                var phone = $('<input size="20" placeholder="+79001234567" type="text"/>');
                $(document.body).append('<br/>', phone, $('<a class="button">Send SMS</a>').click(function () {
                    OAuthDigits('1/sdk/login', {
                        form: {
                            x_auth_phone_number: phone.val(),
                            verification_type: 'sms'
                        },
                        guest: response_activate.guest_token,
                        token_type: response_token.token_type,
                        access_token: response_token.access_token
                    }, function (response_login) {
                        var code = $('<input size="12" placeholder="Code from SMS" type="text"/>');
                        $(document.body).append('<br/>', code, $('<a class="button">Check code</a>').click(function () {
                            OAuthDigits('auth/1/xauth_challenge.json', {
                                form: {
                                    login_verification_request_id: response_login.login_verification_request_id,
                                    login_verification_user_id: response_login.login_verification_user_id,
                                    login_verification_challenge_response: code.val()
                                },
                                guest: response_activate.guest_token,
                                token_type: response_token.token_type,
                                access_token: response_token.access_token
                            }, function (response_xauth) {
                                localStorage.setItem('session_key', response_xauth.oauth_token);
                                localStorage.setItem('session_secret', response_xauth.oauth_token_secret);
                                session_key = response_xauth.oauth_token;
                                session_secret = response_xauth.oauth_token_secret;
                                SignIn3(session_key, session_secret);
                            });
                        }));
                    });
                }));
            });
        });
    }
}

function OAuthDigits(endpoint, options, callback) {
    Progress.start();
    var args = {
        method: 'POST',
        url: 'https://api.digits.com/' + endpoint,
        headers: {
            'Authorization': options.token_type + ' ' + options.access_token
        },
        onload: function (r) {
            Progress.stop();
            if (r.status == 200)
                callback(JSON.parse(r.responseText.replace(/"login_verification_user_id":(\d+)/, '"login_verification_user_id":"$1"'))); // fix for integral precision in JS
            else if (r.status == 401 || r.status == 400)   // wrong sms code
                alert('Authorization error!');
        }
    };
    if (options.guest) {
        args.headers['x-guest-token'] = options.guest;
    }
    if (options.form) {
        args.headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
        args.data = '';
        for (var i in options.form)
            args.data += i + '=' + encodeURIComponent(options.form[i]) + '&';
        args.data = args.data.substr(0, args.data.length - 1);
    }
    GM_xmlhttpRequest(args);
}

function SignInSessionID()
{
    setSet('session_cookie', $('#secret').val());
    if (settings.session_cookie)
    {
        PeriscopeWrapper.V2_POST_Api('user', { cookie: settings.session_cookie }, 
            function (userResponse) 
            {
                loginTwitter = localStorage.getItem('loginTwitter');
                if (!loginTwitter)
                    loginTwitter = {cookie: settings.session_cookie, user: userResponse.user, suggested_username: '', settings: {} };
                loginTwitter.user = userResponse.user;
                loginTwitter.cookie = settings.session_cookie;
                localStorage.setItem('loginTwitter', JSON.stringify(loginTwitter));
                loginTwitter.user.profile_image_urls.sort(function (a, b) {
                    return a.width * a.height - b.width * b.height;
                });
                PeriscopeWrapper.V2_POST_Api('getSettings', {}, 
                    function (settingsResponse) 
                    {
                        loginTwitter.settings = settingsResponse;
                        localStorage.setItem('loginTwitter', JSON.stringify(loginTwitter));
                        Ready(loginTwitter);
                    }
                )
            }
        )
    }
}