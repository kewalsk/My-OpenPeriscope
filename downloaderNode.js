'use strict';
const fs = require('fs'),
    url = require('url'),
    https = require('https'),
    keepAliveAgent = new https.Agent({
        keepAlive: true
    }),
    crypto = require('crypto');

process.stdin.on('data', function (msg) {
    if (msg.toString() === 'q') {
        process.send('Stopped by User');
        process.exit(1);
    }
});

var g_m3u_url = process.argv[process.argv.indexOf('-url') + 1],
    g_replay_m3u_url = process.argv[process.argv.indexOf('-rurl') + 1],
    g_DOWNLOAD_DIR = process.argv[process.argv.indexOf('-dir') + 1],
    g_fileName = process.argv[process.argv.indexOf('-name') + 1],
    g_cookies = process.argv[process.argv.indexOf('-cookies') + 1],
    g_savedDecryptionKey = process.argv[process.argv.indexOf('-key') + 1],
    g_replay_limit = Number(process.argv[process.argv.indexOf('-limit') + 1]),
    g_live_stream = null,
    g_liveTimeout,
    g_timingOut = false,
    g_all_chunks = [], //[chunkxxxx0.ts, chunkxxxx1.ts, ...]
    g_live_chunks_queue = [],
    g_all_replay_chunks = [],
    g_batch_done = true,
    g_live_End,
    g_retries = 70, // number of errors that can happen before downloding stops.
    g_beginnig = true, //skip first timeout
    g_mainInterval,
    g_timeoutInterval,
    g_vod_done = false,
    g_download_Whole = false,
    g_decryptionKey,
    g_chunkIvList = {}, //  videochunk name + Initialization vector pairs
    g_chunksNotAvailable = 0,
    g_nokey = 0,
    g_encrypted = null;

process.on('uncaughtException', function (err) {
    setTimeout(function() {
        process.exit(2);
    }, 1000);
});

g_savedDecryptionKey != 'undefined' ? (g_decryptionKey = Buffer.from(g_savedDecryptionKey, 'base64')) : (g_decryptionKey = null);
if ((g_m3u_url == 'null') || (g_m3u_url == 'undefined')) g_m3u_url = '';
if ((g_replay_m3u_url == 'null') || (g_replay_m3u_url == 'undefined')) g_replay_m3u_url = '';
(g_m3u_url && g_replay_m3u_url) ? (g_download_Whole = true): '';

if (g_download_Whole) {
    g_replay_m3u_url.includes('master_dynamic') ? '' : (g_mainInterval = setInterval(get_playlist, 4000, g_m3u_url));
    get_playlist(g_replay_m3u_url);

} else if (g_replay_m3u_url) {
    get_playlist(g_replay_m3u_url);

} else {
    g_vod_done = true;
    get_playlist(g_m3u_url);
}

function request_options(requestUrl, meth) {
    var options = {
        hostname: url.parse(requestUrl).hostname,
        path: url.parse(requestUrl).path,
        agent: keepAliveAgent
    };
    meth ? (options.method = meth) : '';
    g_cookies ? options.headers = {
        'cookie': g_cookies
    } : '';
    return options;
}

function get_playlist(urlLink) {
    var options = request_options(urlLink);
    var request = https.get(options, function (res) {
        var responseParts = [];
        // res.setEncoding('utf8');
        res.on('data', function (dataChunk) {
            responseParts.push(dataChunk);
        });
        res.on('end', function () {
            var m3u_response = responseParts.join('').trim();
// fs.appendFile(g_DOWNLOAD_DIR + '/' + g_fileName + '.txt', (m3u_response + '\n'), 'utf8', function () {});
            var valid_playlist = m3u_response.includes('#EXTM3U');
            if (valid_playlist) {
                var vod = m3u_response.includes('#EXT-X-PLAYLIST-TYPE:VOD');
                g_live_End = ((m3u_response.lastIndexOf('#EXT-X-ENDLIST') !== -1) && !vod);
                var m3uLines = m3u_response.split('\n');

                (!g_replay_m3u_url && vod) ? (g_replay_m3u_url = g_m3u_url, g_m3u_url = '') : ''; //if someone manually puts replay url into url field.
                
                var playlist_video_chunks = [];
                for (var i = 0; i < m3uLines.length; i++) {
                    if (!/(^#.+|^\/.+)/.test(m3uLines[i])) { //finds chunkxxxx.ts lines
                        if (g_encrypted === null) g_encrypted = m3u_response.includes('#EXT-X-KEY');
                        if (g_encrypted) { //if encrypted fill g_chunkIvList with, video chunk name and it's initalization vector, objects
                            g_chunkIvList[m3uLines[i].split('?')[0]] = m3uLines[i - 2].split(',')[2].split('=')[1].slice(2); //{chunkxxxx0.ts : d37d7010a581ce952a7c9fffdb22fd77, ...}
                        }
                        playlist_video_chunks.push(m3uLines[i].split('?')[0]);
                    }
                }

                if ((g_decryptionKey === null) && m3u_response.includes('#EXT-X-KEY:')) {
                    var keyURI = (/(^#EXT-X-KEY:.+)/m.exec(m3u_response))[0].split('"')[1];
                    getKey(keyURI, 0);
                }

                if (g_live_stream) { //live running
                    g_beginnig = false;
                    playlist_video_chunks.forEach(function (vid_chunk) {
                        if (g_all_chunks.lastIndexOf(vid_chunk) === -1) {
                            g_all_chunks.push(vid_chunk);
                            g_live_chunks_queue.push(vid_chunk);
                        }
                    });

                    timeout_check(120, null, false);
                    if (g_vod_done) {
                        download_live(g_live_End);
                    }

                } else {
                    if (m3u_response.includes('#EXT-X-STREAM-INF')) { // multiple qulities playlist. some producer videos have it.
                        var availableStreamsURLs = m3uLines.filter(function (line) { //list of available streams.
                            return /^\/.+/.test(line);
                        });
                        var newLink = url.resolve('https://' + url.parse(urlLink).host + '/', availableStreamsURLs[availableStreamsURLs.length - 1]); //pick the best quality one
                        if (newLink.endsWith('?type=replay')) {
                            g_replay_m3u_url = newLink;
                        } else {
                            g_m3u_url = newLink;
                            g_mainInterval ? clearInterval(g_mainInterval) : '';
                            g_mainInterval = setInterval(get_playlist, 4000, newLink);
                        }
                        get_playlist(newLink);

                    } else if (vod) {
                        g_download_Whole ? get_playlist(g_m3u_url) : '';
                        if (playlist_video_chunks.length) {
                            if (g_replay_limit){
                                var playlist_duration = Math.round(m3uLines.reduce(function (total, line) {
                                    line.startsWith('#EXTINF:') ? total += Number(/\d+\.\d+/.exec(line)) : ''; 
                                    return total;
                                }, 0));
                                
                                if(playlist_duration > (g_replay_limit + 5)){
                                    var averageChunkDuration = playlist_duration / playlist_video_chunks.length;
                                    var limitedPlaylistLength = Math.round(g_replay_limit / averageChunkDuration);
                                    playlist_video_chunks.splice(0, playlist_video_chunks.length - limitedPlaylistLength);
                                }
                            }
                            g_all_chunks = playlist_video_chunks;
                            g_all_replay_chunks = playlist_video_chunks;
                            download_vod();
                        }

                    } else if (g_live_stream === null) { // live start
                        if (g_download_Whole) {
                            g_live_chunks_queue = playlist_video_chunks.filter(function (elem) {
                                if (!g_all_replay_chunks.includes(elem)) {
                                    return elem;
                                }
                            });
                            g_all_chunks = g_all_replay_chunks.concat(g_live_chunks_queue);
                        } else {
                            g_mainInterval ? clearInterval(g_mainInterval) : '';
                            g_mainInterval = setInterval(get_playlist, 4000, urlLink); //periodically check for updated playlist
                        }
                        g_live_stream = true;

                    }
                }
            } else {
                // no valid playlist
                if (g_live_stream === null && g_m3u_url) { //some broadcasts begin with no valid playlists, treat it as live, with timeout
                    g_live_stream = true;
                    g_mainInterval = setInterval(get_playlist, 4000, urlLink); //periodically check for updated playlist
                } else if (g_live_chunks_queue.length && g_vod_done) {
                    download_live(g_live_End);
                } else {
                    timeout_check(30, ('Warning playlist error, status code: ' + res.statusCode), true);
                }
            }
        });
    });
    request.on('error', function (e) {
        process.send(e) //save to log
        if (g_m3u_url) {
            setTimeout(get_playlist, 4000, urlLink);
        }
        if(g_live_chunks_queue.length && g_vod_done) {
            download_live(g_live_End);
        }else if((g_vod_done || !g_all_replay_chunks.length) && g_batch_done){
            timeout_check(30, ('Warning error when trying to get m3u file: ' + e));
        }
    });
}

function getKey(keyURI, i) {
    var options = request_options(keyURI);
    var dataParts = [];
    https.get(options, function (res) {
        if (res.statusCode == 200) {
            res.on('data', function (chunk) {
                dataParts.push(chunk);
            }).on('end', function () {
                g_decryptionKey = Buffer.concat(dataParts);
            });
        } else {
            process.send('Warning No access to decryption key, statusCode:' + res.statusCode);
            process.exit(3);
        }
    }).on('error', function (e) {
        i += 1;
        process.send('Warning download Key error: ' + e);
        if (i === 2) {
            process.exit(4);
        }
        getKey(keyURI, i)
    });
}

function decrypt(encryptedBuffer, chunk_name) {
    var iv = Buffer.from(g_chunkIvList[chunk_name], "hex");
    var decrypt = crypto.createDecipheriv('aes-128-cbc', g_decryptionKey, iv);
    return Buffer.concat([decrypt.update(encryptedBuffer), decrypt.final()]);
}

function timeout_check(time, msg, stopMainInterval) {
    if (((!g_live_chunks_queue.length) && !g_timingOut && !g_live_End && g_vod_done) || (g_live_stream === null && !g_beginnig)) {
        var counter = 0;
        g_timingOut = true;
        g_liveTimeout = setTimeout(function () {
            endDownloading('Timeout', true);
        }, time * 1000);
        g_timeoutInterval = setInterval(function () {
            counter++;
            var defaultMsg = ('No new video chunks in the last ' + counter + 's');
            counter > 10 ? process.send(msg ? msg : defaultMsg) : '';
        }, 1000);
    } else if (((g_live_chunks_queue.length && !stopMainInterval) || (g_live_stream === null)) && g_timingOut) { // cancel timeout
        clearTimeout(g_liveTimeout);
        clearInterval(g_timeoutInterval)
        g_timingOut = false;
        process.send(' ');
    } else if (stopMainInterval && !g_timingOut){ // no valid playlist, vod might be still downloading.
        process.send('playlist unavailable...');
        g_timingOut = true;
        g_liveTimeout = setTimeout(function () {
            clearInterval(g_mainInterval);
            if(!g_all_chunks.length && !g_all_replay_chunks.length)
                endDownloading();
        }, time * 1000);
    }
}

function download_live(end) {
    !g_beginnig ? process.send('Uptime: ' + formatTime(Math.floor(process.uptime()))) : '';

    if ((g_encrypted && g_decryptionKey) || (g_encrypted === false)) {
        if (g_batch_done && g_live_chunks_queue.length) {
            var i = 0;
            g_batch_done = false;
            var chunks_downloading = g_live_chunks_queue.slice();
            chunks_downloading.forEach(function () {
                g_live_chunks_queue.shift();
            });
            download_file_recur(i, chunks_downloading);
        }else if(g_batch_done && !g_live_chunks_queue.length && end){ // when no new chunks just broadcast end appears on the playlist
            endDownloading('End of broadcast', true);
        }
    } else {
        (g_nokey === 3) ? (process.send('No Key'), process.exit(5)): '';
        g_nokey += 1;
        setTimeout(download_live, 3000, end); //if key not available try again after some time /async workaround
    }

    function download_file_recur(i, chunks_downloading, retryTimes = 3) {
        if (i === chunks_downloading.length) {
            g_batch_done = true;
            if (end) endDownloading('End of broadcast', true);
        } else {
            var file_url = url.resolve(g_m3u_url, chunks_downloading[i]); //replace /playlist.m3u8 with /chunk_i.ts in url to get chunk url.
            var options = request_options(file_url);
            var dataParts = [];

            var request = https.get(options, function (res) {
                res.on('data', function (data) {
                    dataParts.push(data);
                }).on('end', function () {
                    var chunkBuffer = Buffer.concat(dataParts);

                    if (res.statusCode == 404) {
                        i += 1;
                        download_file_recur(i, chunks_downloading);
                    } else if (res.statusCode == 200) {           
                        if (res.headers['content-length'] === chunkBuffer.length.toString()) {
                            if (g_encrypted) {
                                chunkBuffer = decrypt(chunkBuffer, chunks_downloading[i]);
                            }

                            fs.appendFile(g_DOWNLOAD_DIR + g_fileName + '.ts', chunkBuffer, { //concatenate incoming live video chunks
                                encoding: 'binary'
                            }, function (err) {
                                if (err) {
                                    process.send('Error appending live chunk: ' + err.code); // log error and try to continue
                                    if (err.code === 'ENOENT') {
                                        process.send('Error no folder, Exiting.');
                                        throw err;
                                    }
                                    if (g_retries > 0) {
                                        g_retries -= 1;
                                        download_file_recur(i, chunks_downloading);
                                    } else {
                                        process.send('Error appending live chunk, Exiting: ' + err.code);
                                        process.send(err);
                                        throw err;
                                    }
                                } else {
                                    i += 1;
                                    download_file_recur(i, chunks_downloading);
                                }
                            });

                        } else {
                            download_file_recur(i, chunks_downloading);
                        }
                    } else {
                        if (g_retries > 0) {
                            g_retries -= 1;
                            setTimeout(download_file_recur, 1000, i, chunks_downloading);
                        }
                    }
                });
            });
            request.on('error', function (e) {
                process.send('Warning download file error: ' + e);
                if (g_retries > 0) {
                    g_retries -= 1;
                    setTimeout(download_file_recur, 1000, i, chunks_downloading);
                } else {
                    process.send('Error downloading file, Exiting: ' + e);
                    process.send(e);
                    process.exit(10);
                }
            });
        }
    }
}

function download_vod() {
    if ((g_encrypted && g_decryptionKey) || (g_encrypted === false)) {
        var i = 0;
        download_vod_recur(i);
    } else {
        (g_nokey === 3) ? process.exit(6): '';
        g_nokey += 1;
        setTimeout(download_vod, 1000); //if key not available try again after some time /async workaround
    }

    function download_vod_recur(i) {
        if (i === (g_all_replay_chunks.length - g_chunksNotAvailable)) {
            if (g_download_Whole) {
                endDownloading((g_chunksNotAvailable ? 'Replay missing ' + g_chunksNotAvailable + ' parts' : ('Replay Downloaded, Recording Live')), false);
            } else {
                endDownloading((g_chunksNotAvailable ? 'Finished, missing ' + g_chunksNotAvailable + ' parts' : ('Replay Downloaded')), false);
            }
        } else {
            var progress = Math.round(((i + 1) / (g_all_replay_chunks.length - g_chunksNotAvailable)) * 100) + '%';
            process.send(progress);

            var file_url = url.resolve(g_replay_m3u_url, g_all_replay_chunks[i]); //replace /playlist.m3u8 with /chunk_i.ts in url to get chunk url.
            var options = request_options(file_url);
            var dataParts = [];

            var request = https.get(options, function (res) {
                res.on('data', function (data) {
                    dataParts.push(data);
                }).on('end', function () {
                    if (res.statusCode == 404) {
                        process.send('404')
                        fs.appendFile(g_DOWNLOAD_DIR + '/' + g_fileName + '.txt', (file_url + ' <= was not found, Video is incomplete: ' + res.statusCode + '\n'), function () {});
                        g_chunksNotAvailable += 1;
                        i += 1;
                        download_vod_recur(i);
                    } else if (res.statusCode == 200) {
                        var chunkBuffer = Buffer.concat(dataParts);

                        if (res.headers['content-length'] === chunkBuffer.length.toString()) {
                            if (g_encrypted) {
                                chunkBuffer = decrypt(chunkBuffer, g_all_replay_chunks[i]);
                            }

                            fs.appendFile(g_DOWNLOAD_DIR + g_fileName + '.ts', chunkBuffer, { //concatenate incoming live video chunks
                                encoding: 'binary'
                            }, function (err) {
                                if (err) {
                                    process.send('Error appending vod chunk: ' + err.code); // log error and try to continue
                                    if (err.code === 'ENOENT') {
                                        process.send('Error no folder, Exiting.');
                                        throw err;
                                    }
                                    if (g_retries > 0) {
                                        g_retries -= 1;
                                        download_vod_recur(i);
                                    } else {
                                        process.send('Error appending live chunk, Exiting: ' + err.code);
                                        throw err;
                                    }
                                } else {
                                    i += 1;
                                    download_vod_recur(i);
                                }
                            });
                        } else {
                            download_vod_recur(i)
                        }
                    } else {
                        if (g_retries > 0) {
                            g_retries -= 1;
                            setTimeout(download_vod_recur, 1000, i);
                        }
                    }
                });
            });
            request.on('error', function (e) {
                process.send('Warning download file error: ' + e);
                if (g_retries > 0) {
                    g_retries -= 1;
                    setTimeout(download_vod_recur, 500, i);
                } else {
                    process.send('Error downloading file,  Exiting: ' + e);
                    process.send(e);
                    throw e;
                }
            });
        }
    }
}

function endDownloading(message, isLive) {
    if(g_all_chunks.length || g_all_replay_chunks.length){
        if (g_download_Whole) {
            if (isLive) {
                clearInterval(g_mainInterval);
                clearInterval(g_timeoutInterval);
                setTimeout(function () {
                    process.send(message);
                    process.exit();
                }, 1000);
            } else {
                process.send(message);
                g_vod_done = true;
                download_live(g_live_End);
            }
        } else {
            setTimeout(function () {
                process.send(message);
                process.exit();
            }, 1000);
        }
    }else{
        process.exit(7);
    }
}

function formatTime(time) {
    var hrs = ~~(time / 3600);
    var mins = ~~((time % 3600) / 60);
    var secs = time % 60;
    var ret = '';
    if (hrs > 0) {
        ret += '' + hrs + ':' + (mins < 10 ? "0" : '');
    }
    ret += '' + mins + ':' + (secs < 10 ? '0' : '') + secs;
    return ret;
}