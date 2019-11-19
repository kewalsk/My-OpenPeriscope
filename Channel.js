var ChannelController = {
    caller_callback: null,
    CID: "",
    Channel: {},
    MembersArray: [],
    moreMembers: true,
    membersBatchCursor: "",
    membersSorting: "As Retrieved", // probably by userid
    membersSortingDir: "A",
    ActionsArray: [],
    moreActions: true,
    actionsBatchCursor: "",
    actionsSorting: "Time",
    actionsSortingDir: "D",
    actionsFilterAdding: true,
    actionsFilterRemoving: true,
    usersCache: undefined,

    init: function(parent, callback)
    {
        this.caller_callback = callback;

        var resultChannel = $('<div id="resultChannel" />');

        var showButton = $('<a class="button" id="showchannel">OK</a>').click(function () {
            resultChannel.empty();
            ChannelController.CID = $('#channel_id').val().trim();
            if (ChannelController.CID) {
                PeriscopeWrapper.V1_GET_ApiChannels(function (response) {
                    ChannelController.CID = response.Channel.CID;
                    ChannelController.Channel = response.Channel;
                    ChannelController.moreMembers = true;
                    ChannelController.MembersArray = [];
                    ChannelController.moreActions = true;
                    ChannelController.ActionsArray = [];
                    $('#channel_id').val(ChannelController.CID);
                    var channel_created = $('<span>Created: </span><span class="date icon">'+formatDate(new Date(response.Channel.CreatedAt)) +'</span>');
                    var channel_owner = $('<span id="ChannelOwnerInfo" class="username">  by: <a>' + response.Channel.OwnerId + '</a></span>').click(switchSection.bind(null, 'User', response.Channel.OwnerId));
                    PeriscopeWrapper.V2_POST_Api('user', { user_id: response.Channel.OwnerId },
                        function (userResponse) {
                            $('#ChannelOwnerInfo')
                                .empty()
                                .append($('<span id="ChannelOwnerInfo" class="username">  by: ' + emoji_to_img(userResponse.user.display_name) + ' (@<a>' + userResponse.user.username + '</a> / <a>'+userResponse.user.id+')</a></span>'));
                        },
                        function () {
                            $('#ChannelOwnerInfo')
                                .empty()
                                .append($('<span id="ChannelOwnerInfo">  by: <a>' + response.Channel.OwnerId + '</a> (banned user)</span>'));
                        });
                    var channel_lastact = $('<span>\t\tLast activity: </span><span class="date icon">'+formatDate(new Date(response.Channel.LastActivity)) +'</span>');
                    var channel_restricted = $('<span>'+(response.Channel.RestrictMembersManagement ? '&#128272; restricted':'')+'</span>');
                    var channel_info = $('<div id="ChannelInfo" />').append(channel_created,channel_owner, channel_lastact, channel_restricted)
                    resultChannel.prepend(channel_info);
                    resultChannel.prepend('<h3 id="ChannelName">' + emoji_to_img(response.Channel.Name) + '</h3>');
                    $('#BroadcastsSpoilerTitle')[0].innerText = 'Broadcasts (' + response.Channel.NLive + ')';
                    $('#MembersSpoilerTitle')[0].innerText = 'Members (' + (response.Channel.NMember === 1000 ? '>=' : '') + response.Channel.NMember + ')';
                }, 'https://channels.pscp.tv/v1/channels/' + ChannelController.CID);
            }

            var BroadcastsSpoiler = $('<div id="BroadcastsSpoilerTitle" class="spoiler menu" data-spoiler-link="broadcasts">Broadcasts</div>')
                .on("jq-spoiler-visible", function () { ChannelController.showBroadcasts();});

            var MembersSpoiler = $('<div id="MembersSpoilerTitle" class="spoiler menu" data-spoiler-link="members">Members </div>')
                .on("jq-spoiler-visible", function () { ChannelController.showMembers();});

            var ActionsSpoiler = $('<div id="ActionsSpoilerTitle" class="spoiler menu" data-spoiler-link="actions">History</div>')
                .on("jq-spoiler-visible", function () { ChannelController.showActions();});

            resultChannel.append(BroadcastsSpoiler, '<div class="spoiler-content" data-spoiler-link="broadcasts" id="channelBroadcasts" />',
                                 MembersSpoiler, '<div class="spoiler-content" data-spoiler-link="members" id="channelMembers" />',
                                 ActionsSpoiler, '<div class="spoiler-content" data-spoiler-link="actions" id="channelActions" />');
            $(".spoiler").spoiler({triggerEvents: true});
        });

        var idInput = $('<div id="Channel">CID: <input id="channel_id" type="text" size="20" placeholder="channel_id"></div>');
        $('#right').append(idInput.append(showButton, resultChannel));
    },

    showBroadcasts: function() {
        var broadcastsDiv = $('#channelBroadcasts');
        if (!broadcastsDiv.html()) {
            PeriscopeWrapper.V1_GET_ApiChannels(function (channelBroadcasts) {
                ChannelController.createBroadcastsList(broadcastsDiv, null)(channelBroadcasts);
                $('#BroadcastsSpoilerTitle')[0].innerText = 'Broadcasts (' + channelBroadcasts.NLive + '/' + channelBroadcasts.NReplay + ')';
            }, 'https://channels.pscp.tv/v1/channels/' + ChannelController.CID + '/broadcasts');
        }
    },

    createBroadcastsList: function(jcontainer, title) {
        return function (response) {
            jcontainer.html(title || '<div style="clear:both"/>');
            if (response.Broadcasts.length) {
                var ids = [];
                var createCard = function (index) {
                    var resp = response.Broadcasts[index];
                };
            } else
                jcontainer.append('No results');
            var top = jcontainer.offset().top;
            if ($(window).scrollTop() + $(window).height() - 100 < top) {
                $(window).scrollTop(top);
            }
        }
    },


    showMembers: function() {
        var membersDiv = $('#channelMembers');
        if (!membersDiv.html()) {
            var refreshButton = $('<a class="btn-small" id="refreshButton">Refresh</a>').click(ChannelController.reloadMembers.bind(this));
            var getMoreButton = $('<a class="btn-small" id="getMoreButton">Get More</a>').click(ChannelController.getMoreMembers.bind(this));
            var getAllButton = $('<a class="btn-small" id="getAllButton">Get All</a>').click(ChannelController.getAllMembers.bind(this));
            var membersButtons = $('<div class="btn-group"></div>').append(refreshButton, getMoreButton, getAllButton);
            if (!ChannelController.Channel.RestrictMembersManagement || ChannelController.Channel.OwnerId === loginTwitter.user.id) {
                if (settings.channelConfirmKickOut === undefined)
                    setSet('channelConfirmKickOut', true);
                var askLeaveChk = $('<input id="channelAskKick" type="checkbox">').change(function () {
                    setSet('channelConfirmKickOut', this.checked);
                });
                askLeaveChk.prop("checked", settings.channelConfirmKickOut);
                var askLeave = $('<label>Confirm Kick  </label>').prepend(askLeaveChk);
            }

            if (settings.channelLargePictures === undefined)
                setSet('channelLargePictures', false);
            var channelLargePicturesChk = $('<input id="channelLargePictures" type="checkbox">').change(function () {
                setSet('channelLargePictures', this.checked);
                ChannelController.updateMemberList(0, ChannelController.MembersArray.length);
            });
            channelLargePicturesChk.prop("checked", settings.channelLargePictures);
            var channelLargePictures = $('<label>Large pictures   </label>').prepend(channelLargePicturesChk);

            if (settings.channelCaseSensitive === undefined)
                setSet('channelCaseSensitive', true);
            var caseSensitiveChk = $('<input id="channelCaseSensitive" type="checkbox">').change(function () {
                setSet('channelCaseSensitive', this.checked);
                if (ChannelController.membersSorting === "Name") {
                    ChannelController.membersSortingDir = (MembershipController.membersSortingDir === 'D' ? 'A': 'D')
                    ChannelController.sortMembersView(ChannelController.membersSorting);
                }
            });
            caseSensitiveChk.prop("checked", settings.channelCaseSensitive);
            var caseSensitive = $('<label>Case sensitive sorting   </label>').prepend(caseSensitiveChk);

            var membersView = $('<div id="channelMembersView" />');
            membersDiv.append(membersButtons, askLeave, channelLargePictures, caseSensitive, membersView);
            ChannelController.getMembers(false);
        }
    },

    getUsers: function(memberIndex) {
        if (memberIndex < ChannelController.MembersArray.length) {
            var uids = [];
            var nUsers = Math.min(100, ChannelController.MembersArray.length - memberIndex);
            for (var i = 0; i < nUsers; i++)
                uids.push(ChannelController.MembersArray[i+memberIndex].UserId);
            PeriscopeWrapper.V2_POST_Api('users', {user_ids: uids}, function (usersResponse) {
                if (usersResponse.users.length) {
                    if (!ChannelController.usersCache)
                        ChannelController.usersCache = new Map();
                    for (var j in usersResponse.users)
                        ChannelController.usersCache.set(usersResponse.users[j].id, usersResponse.users[j]);

                    for (var u = 0; u < nUsers; u++) {
                        //var user = usersResponse.users.find( element => element.id === ChannelController.MembersArray[u+memberIndex].UserId ); // this is not working

                        var user = ChannelController.usersCache.get(ChannelController.MembersArray[u + memberIndex].UserId);
                        if (user) {
                            var pendingInvite = ChannelController.MembersArray[u + memberIndex].PendingInviteAt;
                            ChannelController.MembersArray[u + memberIndex] = user;
                            ChannelController.MembersArray[u + memberIndex].UserId = user.id;
                            ChannelController.MembersArray[u + memberIndex].PendingInviteAt = pendingInvite;
                            ChannelController.MembersArray[u + memberIndex].is_banned = false;
                        }
                        else
                            ChannelController.MembersArray[u + memberIndex].is_banned = true;
                        /*
                        for (var j in usersResponse.users) {
                            if (usersResponse.users[j].id === ChannelController.MembersArray[u + memberIndex].UserId) {
                                // how to merge objects?
                                // ChannelController.MembersArray[u + memberIndex] = ChannelController.MembersArray[u + memberIndex].merge(usersResponse.users[j]); // this is not working (.merge is not a function)
                                var pendingInvite = ChannelController.MembersArray[u + memberIndex].PendingInviteAt;
                                ChannelController.MembersArray[u + memberIndex] = usersResponse.users[j];
                                ChannelController.MembersArray[u + memberIndex].UserId = usersResponse.users[j].id;
                                ChannelController.MembersArray[u + memberIndex].PendingInviteAt = pendingInvite;
                                ChannelController.MembersArray[u + memberIndex].is_banned = false;
                                break;
                            }
                        }
                        */
                    }
                }
                ChannelController.updateMemberList(memberIndex, nUsers);
                if (memberIndex+nUsers < ChannelController.MembersArray.length)
                    ChannelController.getUsers(memberIndex+nUsers);
                //else
                //    ChannelController.updateMemberList(memberIndex, ChannelController.MembersArray.length-memberIndex);
            });
        }
    },

    getMembers: function(all) {
        if (ChannelController.moreMembers) {
            var url_root = 'https://channels.pscp.tv/v1/channels/' + ChannelController.CID + '/members';
            if (ChannelController.MembersArray.length && ChannelController.membersBatchCursor !== "")
                url_root += '?cursor=' + ChannelController.membersBatchCursor;
            PeriscopeWrapper.V1_GET_ApiChannels(function (response) {
                ChannelController.moreMembers = response.HasMore;
                ChannelController.membersBatchCursor = response.Cursor;
                if (response.Members.length) {
                    var prevLen = ChannelController.MembersArray.length;
                    if (prevLen > 0)
                        ChannelController.MembersArray = ChannelController.MembersArray.concat(response.Members);
                    else
                        ChannelController.MembersArray = response.Members;
                    if (!all || !response.HasMore) {
                        $('#MembersSpoilerTitle')[0].innerText = 'Members (' + (ChannelController.Channel.NMember === 1000 ? '>=' : '') + ChannelController.Channel.NMember + '/' + ChannelController.MembersArray.length + (ChannelController.moreMembers ? '...' : '') + ')';
                        if (!ChannelController.moreMembers) {
                            $('#ChannelMembersViewGetMore').hide();
                            $('#getAllButton').hide();
                            $('#getMoreButton').hide();
                            $('#getMoreBottomButton').hide();
                        }
                        if (prevLen === 0) {
                            var membersView = $('#channelMembersView');
                            ChannelController.displayMembersList(membersView, 0);
                        } //else if (response.Members.length > prevLen)
                          //  ChannelController.updateMemberList(prevLen, response.Members.length - prevLen);
                    }
                    else
                        ChannelController.getMembers(all);
                    ChannelController.getUsers(prevLen);
                }
            }, url_root);
        }
    },

    reloadMembers: function() {
        $('#refreshButton').addClass('activated');
        ChannelController.MembersArray = [];
        ChannelController.moreMembers = true;
        $('#channelMembersView').empty();
        $('#ChannelMembersViewGetMore').show();
        $('#getAllButton').show();
        $('#getMoreButton').show();
        $('#getMoreBottomButton').show();
        ChannelController.getMembers(false);
    },

    getMoreMembers: function() {
        $('#getMoreButton').addClass('activated');
        ChannelController.getMembers(false);
    },

    getAllMembers: function() {
        var btn = $('#getAllButton');
        btn.addClass('activated');
        if (ChannelController.Channel.NMember === 1000) {
            if (confirm('The group ' + ChannelController.CID + ' ' + ChannelController.Channel.Name + ' is reporting to have 1000 or more members. Are you sure you want get ALL? This could take really long time...'))
                ChannelController.getMembers(true);
        }
        else
            ChannelController.getMembers(true);
    },

    displayMembersList: function(container, position) {
        //console.log('displayMembersList( ' +  position + ' ) / ' + ChannelController.MembersArray.length );
        if (ChannelController.MembersArray && ChannelController.MembersArray.length) {
            if (!container.html()) {
                //var colHeader1 = $('<th><span class="table-sprites ' + (ChannelController.membersSorting === 'As Retrieved' ? (ChannelController.membersSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span>P.</span></th>').click(ChannelController.sortMembersView.bind(this, 'As Retrieved'));
                var colHeader2 = $('<th><span class="table-sprites table-sortnone"></span><span>Picture</span></th>');
                var colHeader3 = $('<th><span class="table-sprites ' + (ChannelController.membersSorting === 'UserId' ? (ChannelController.membersSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span>UserId</span></th>').click(ChannelController.sortMembersView.bind(this, 'UserId'));
                var colHeader4 = $('<th><span class="table-sprites ' + (ChannelController.membersSorting === 'Created' ? (ChannelController.membersSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span>Created</span></th>').click(ChannelController.sortMembersView.bind(this, 'Created'));
                var colHeader5 = $('<th><span class="table-sprites ' + (ChannelController.membersSorting === 'Name' ? (ChannelController.membersSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span>Name</span></th>').click(ChannelController.sortMembersView.bind(this, 'Name'));
                var colHeader6 = $('<th><span class="table-sprites ' + (ChannelController.membersSorting === 'Display Name' ? (ChannelController.membersSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span>Display name</span></th>').click(ChannelController.sortMembersView.bind(this, 'Display Name'));
                var colHeader7 = $('<th><span class="table-sprites ' + (ChannelController.membersSorting === 'Description' ? (ChannelController.membersSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span>Description</span></th>').click(ChannelController.sortMembersView.bind(this, 'Description'));
                var colHeader8 = $('<th><span class="table-sprites ' + (ChannelController.membersSorting === 'Twitter' ? (ChannelController.membersSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span>Twitter</span></th>').click(ChannelController.sortMembersView.bind(this, 'Twitter'));
                var colHeader9 = $('<th><span class="table-sprites ' + (ChannelController.membersSorting === 'Invited' ? (ChannelController.membersSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span>Invited</span></th>').click(ChannelController.sortMembersView.bind(this, 'Invited'));
                var colHeader10 = $('<th><span class="table-sprites ' + (ChannelController.membersSorting === 'Followers' ? (ChannelController.membersSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span title="Followers">F</span></th>').click(ChannelController.sortMembersView.bind(this, 'Followers'));
                var colHeader11 = $('<th><span class="table-sprites ' + (ChannelController.membersSorting === 'Following' ? (ChannelController.membersSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span title="Following">F</span></th>').click(ChannelController.sortMembersView.bind(this, 'Following'));
                var colHeader12 = $('<th><span class="table-sprites ' + (ChannelController.membersSorting === 'Hearts' ? (ChannelController.membersSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span title="Hearts">H</span></th>').click(ChannelController.sortMembersView.bind(this, 'Hearts'));
                var colHeaderActions = $('<th><span class="table-sprites table-sortnone"></span></th>');
                var tableHeaderRow = $('<tr></tr>>')
                    //.append(colHeader1)
                    .append(colHeader2)
                    .append(colHeader3)
                    .append(colHeader4)
                    .append(colHeader5)
                    .append(colHeader6)
                    .append(colHeader7)
                    .append(colHeader8)
                    .append(colHeader9)
                    .append(colHeader10)
                    .append(colHeader11)
                    .append(colHeader12)
                    .append(colHeaderActions);
                var tableHeader = $('<thead></thead>>').append(tableHeaderRow);
                var table = $('<table id="ChannelMembersTable" class="blueTable"></table>')
                    .append(tableHeader)
                    .append($('<tbody id="ChannelMembersTableBody"></tbody>'));
                var searchInput = $('<input type="text" id="ChannelMembersSearch" placeholder="Type to search..." />').keyup( function () {
                    var searchText = $(this).val().toLowerCase();
                    // Show only matching TR, hide rest of them
                    $.each($("#ChannelMembersTable tbody tr"), function() {
                        if($(this).text().toLowerCase().indexOf(searchText) === -1)
                            $(this).hide();
                        else
                            $(this).show();
                        $(window).trigger('scroll');
                    });
                });
                container.append(searchInput,table);
                if (ChannelController.moreMembers) {
                    var getMoreButton = $('<a class="btn-small" id="getMoreBottomButton">Get More</a>').click(ChannelController.getMoreMembers.bind(this));
                    var membersButtons = $('<div id="ChannelMembersViewGetMore" class="btn-group"></div>').append(getMoreButton );
                    container.append(membersButtons);
                }
            }
            //ChannelController.updateMemberList(position, ChannelController.MembersArray.length)
        }
        else
            container.html('No results');
    },

    updateMemberList: function(memberIndex, nUsers) {
        //console.log('updateMemberList( ' +  memberIndex + ', ' + nUsers + ' ) / ' + ChannelController.MembersArray.length );
        var pheight = settings.channelLargePictures ? 64 : 32;
        for (var i = memberIndex; i < ChannelController.MembersArray.length && i < memberIndex + nUsers; i++) {
            // TODO: display array with paging
            var member = ChannelController.MembersArray[i];
            var buttons = $('<td class="memberActions text-right"></td>')
                .append($('<div class="btn-group"></div>'));
            if (!ChannelController.Channel.RestrictMembersManagement || ChannelController.Channel.OwnerId === loginTwitter.user.id) {
                buttons.append($('<button type="submit" class="btn btn-secondary btn-sm"><i class="fas fa-running"></i><span class="d-none d-md-inline">Kick</span></button>')
                    .click(ChannelController.leaveChannel.bind(this, member)));
            }
            var btnflw = (member.is_following ?
                $('<button type="submit" class="btn btn-info btn-sm activated fixed-width-80"><i class="fas fa-file-signature"></i><span class="d-none d-md-inline">Unfollow</span></button>') :
                $('<button type="submit" class="btn btn-primary btn-sm fixed-width-80"><i class="fas fa-file-signature"></i><span class="d-none d-md-inline">Follow</span></button>'));
            btnflw.click(ChannelController.followMemberToggle.bind(this, member, btnflw));
            buttons.append(btnflw);
            var btnblk = (member.is_blocked ?
                $('<button type="submit" class="btn btn-warning btn-sm fixed-width-75"><i class="fas fa-undo-alt"></i><span class="d-none d-md-inline">Unblock</span></button>') :
                $('<button type="submit" class="btn btn-danger btn-sm fixed-width-75"><i class="fas fa-trash-alt"></i><span class="d-none d-md-inline">Block</span></button>'));
            btnblk.click(ChannelController.blockMemberToggle.bind(this, member, btnblk));
            buttons.append(btnblk);
            var user_picture = $('<td class="memberPicture"></td>');
            if (member.profile_image_urls && member.profile_image_urls.length)
                user_picture.append('<a href="' + (member.profile_image_urls[member.profile_image_urls.length - 1].url.includes("googleusercontent.com/") ?
                    member.profile_image_urls[member.profile_image_urls.length - 1].url.replace("s96-c", "s0") :
                    member.profile_image_urls[0].url)
                    + '" target="_blank"><img class="avatar" height="'+pheight+'" lazysrc="' + member.profile_image_urls[member.profile_image_urls.length - 1].url + '"></a>');
            else
                user_picture.append('<img class="avatar" height="'+pheight+'"/>');
            var user_id = $('<td class="memberUserId"><a>' + member.UserId + '</a></td>').click(switchSection.bind(null, 'User', member.UserId));
            var user_name = (member.is_banned ?
                $('<td class="memberName">' + '(banned)' + '</td>').click(switchSection.bind(null, 'User', member.UserId)) :
                $('<td class="memberName"><a>' + (member.username ? member.username : '') + '</a></td>').click(switchSection.bind(null, 'User', member.UserId)) );
            var table_row = $('#UID_' + member.UserId);
            if (table_row)
                table_row.remove();
            $('#ChannelMembersTableBody').append($('<tr id="UID_' + member.UserId + '">')
                //.append($('<td class="memberPos">' + i + '</td>'))
                .append(user_picture)
                .append(user_id)
                .append($('<td class="memberCreated">' + (member.created_at ? formatDate(new Date(member.created_at)) : '') + '</td>'))
                .append(user_name)
                .append($('<td class="memberDisplayName">' + (member.display_name ? emoji_to_img(member.display_name) : '') + '</td>'))
                .append($('<td class="memberDescription">' + (member.description ? emoji_to_img(member.description) : '') + '</td>'))
                .append($('<td class="memberTwitterName">' + (member.twitter_screen_name ? member.twitter_screen_name : '') + '</td>'))
                .append($('<td class="memberPendingInvite">' + (member.PendingInviteAt ? formatDate(new Date(member.PendingInviteAt)) : '') + '</td>'))
                .append($('<td class="membersFollowers">' + (member.n_followers ? member.n_followers : 0) + '</td>'))
                .append($('<td class="membersFollowing">' + (member.n_following ? member.n_following : 0) + '</td>'))
                .append($('<td class="membersHearts">' + (member.n_hearts ? member.n_hearts : 0) + '</td>'))
                .append(buttons)
            );
        }
        $('#getMoreButton').removeClass('activated');
        $('#getAllButton').removeClass('activated');
        $('#refreshButton').removeClass('activated');
        $(window).trigger('scroll');
    },

    leaveChannel: function(member) {
        var user = (member.display_name ? member.display_name +' (@'+member.username +')' : member.UserId  )
        if (!settings.channelConfirmKickOut || confirm('Are you sure you want to kick user ' + user + ' out of the group ' + ChannelController.CID + ' ' + ChannelController.Channel.Name + '?')) {
            PeriscopeWrapper.V1_ApiChannels(
                function (response) {
                    //if (settings.channelConfirmKickOut)
                    //    window.alert("User "+user+" successfully deleted from channel " + ChannelController.CID + " " + ChannelController.Channel.Name  );
                    var table_row = $('#UID_' + member.UserId);
                    if (table_row)
                        table_row.remove();
                },
                "https://channels.pscp.tv/v1/channels/" + ChannelController.CID + "/members/" + member.UserId,
                null,
                null,
                "DELETE"
            );
        }
    },

    followMemberToggle: function(member, button) {
        PeriscopeWrapper.V2_POST_Api((member.is_following ? 'unfollow':'follow'), {
            user_id: member.UserId
        }, function (r) {
            if (r.success) {
                if (member.is_following) {
                    member.is_following = false;
                    button[0].innerHTML = '<i class="fas fa-file-signature"></i><span class="d-none d-md-inline">Follow</span>';
                    button.removeClass('activated');
                    button.removeClass('btn-info');
                    button.addClass('btn-primary');
                }
                else
                {
                    member.is_following = true;
                    button[0].innerHTML = '<i class="fas fa-file-signature"></i><span class="d-none d-md-inline">Unfollow</span>';
                    button.addClass('activated');
                    button.removeClass('btn-primary');
                    button.addClass('btn-info');
                }
            }
        })
    },

    blockMemberToggle: function(member, button) {
        PeriscopeWrapper.V2_POST_Api((member.is_blocked ? 'block/remove':'block/add'), {
            to: member.UserId
        }, function (r) {
            if (r.success) {
                if (member.is_blocked) {
                    member.is_blocked = false;
                    button[0].innerHTML = '<i class="fas fa-trash-alt"></i><span class="d-none d-md-inline">Block</span>';
                    button.removeClass('btn-warning');
                    button.addClass('btn-danger');
                }
                else
                {
                    member.is_blocked = true;
                    button[0].innerHTML = '<i class="fas fa-undo-alt"></i><span class="d-none d-md-inline">Unblock</span>';
                    button.removeClass('btn-danger');
                    button.addClass('btn-warning');
                }
            }
        })
    },

    sortMembersView: function(col) {
        if (col === ChannelController.membersSorting ) {
            ChannelController.membersSortingDir = (ChannelController.membersSortingDir === 'D' ? 'A' : 'D');
        }
        else {
            ChannelController.membersSorting = col;
            ChannelController.membersSortingDir = (col === 'Created' || col === 'Invited' || col === 'Followers' || col === 'Following' || col === 'Hearts' ? 'D' : 'A');
        }
        var membersView = $('#channelMembersView');
        membersView.empty();
        membersView.append($('<h3>Sorting......</h3>'));
        membersView.ready(function () {
            switch (ChannelController.membersSorting) {
                case 'UserId':
                    if (ChannelController.membersSortingDir === 'A')
                        ChannelController.MembersArray.sort(function (a, b) { return (a.UserId > b.UserId ? 1 : a.UserId < b.UserId ? -1 : 0); });
                    else
                        ChannelController.MembersArray.sort(function (a, b) { return (a.UserId > b.UserId ? -1 : a.UserId < b.UserId ? 1 : 0); });
                    break;
                case 'Created':
                    if (ChannelController.membersSortingDir === 'A')
                        ChannelController.MembersArray.sort(function (a, b) { return (a.created_at === undefined ? 1 : b.created_at === undefined ? -1 : a.created_at > b.created_at ? 1 : a.created_at < b.created_at ? -1 : 0); });
                    else // intentionally leave banned users always at the end of list
                        ChannelController.MembersArray.sort(function (a, b) { return (a.created_at === undefined ? 1 : b.created_at === undefined ? -1 : a.created_at > b.created_at ? -1 : a.created_at < b.created_at ? 1 : 0); });
                    break;
                case 'Name':
                    if (settings.channelCaseSensitive) {
                        if (ChannelController.membersSortingDir === 'A')
                            ChannelController.MembersArray.sort(function (a, b) {
                                return (a.username === undefined ? 1 : b.username === undefined ? -1 : a.username > b.username ? 1 : a.username < b.username ? -1 : 0);
                            });
                        else
                            ChannelController.MembersArray.sort(function (a, b) {
                                return (a.username === undefined ? 1 : b.username === undefined ? -1 : a.username > b.username ? -1 : a.username < b.username ? 1 : 0);
                            });
                    }
                    else
                    {
                        if (ChannelController.membersSortingDir === 'A')
                            ChannelController.MembersArray.sort(function (a, b) {
                                return (a.username === undefined ? 1 : b.username === undefined ? -1 : a.username.toUpperCase() > b.username.toUpperCase() ? 1 : a.username.toUpperCase() < b.username.toUpperCase() ? -1 : 0);
                            });
                        else
                            ChannelController.MembersArray.sort(function (a, b) {
                                return (a.username === undefined ? 1 : b.username === undefined ? -1 : a.username.toUpperCase() > b.username.toUpperCase() ? -1 : a.username.toUpperCase() < b.username.toUpperCase() ? 1 : 0);
                            });
                    }
                    break;
                case 'Display Name':
                    if (settings.channelCaseSensitive) {
                        if (ChannelController.membersSortingDir === 'A')
                            ChannelController.MembersArray.sort(function (a, b) {
                                return (a.display_name === undefined ? 1 : b.display_name === undefined ? -1 : a.display_name > b.display_name ? 1 : a.display_name < b.display_name ? -1 : 0);
                            });
                        else
                            ChannelController.MembersArray.sort(function (a, b) {
                                return (a.display_name === undefined ? 1 : b.display_name === undefined ? -1 : a.display_name > b.display_name ? -1 : a.display_name < b.display_name ? 1 : 0);
                            });
                    }
                    else
                    {
                        if (ChannelController.membersSortingDir === 'A')
                            ChannelController.MembersArray.sort(function (a, b) {
                                return (a.display_name === undefined ? 1 : b.display_name === undefined ? -1 : a.display_name.toUpperCase() > b.display_name.toUpperCase() ? 1 : a.display_name.toUpperCase() < b.display_name.toUpperCase() ? -1 : 0);
                            });
                        else
                            ChannelController.MembersArray.sort(function (a, b) {
                                return (a.display_name === undefined ? 1 : b.display_name === undefined ? -1 : a.display_name.toUpperCase() > b.display_name.toUpperCase() ? -1 : a.display_name.toUpperCase() < b.display_name.toUpperCase() ? 1 : 0);
                            });
                    }
                    break;
                case 'Description':
                    if (settings.channelCaseSensitive) {
                        if (ChannelController.membersSortingDir === 'A')
                            ChannelController.MembersArray.sort(function (a, b) {
                                return (a.description === undefined ? 1 : b.description === undefined ? -1 : a.description > b.description ? 1 : a.description < b.description ? -1 : 0);
                            });
                        else
                            ChannelController.MembersArray.sort(function (a, b) {
                                return (a.description === undefined ? 1 : b.description === undefined ? -1 : a.description > b.description ? -1 : a.description < b.description ? 1 : 0);
                            });
                    }
                    else
                    {
                        if (ChannelController.membersSortingDir === 'A')
                            ChannelController.MembersArray.sort(function (a, b) {
                                return (a.description === undefined ? 1 : b.description === undefined ? -1 : a.description.toUpperCase() > b.description.toUpperCase() ? 1 : a.description.toUpperCase() < b.description.toUpperCase() ? -1 : 0);
                            });
                        else
                            ChannelController.MembersArray.sort(function (a, b) {
                                return (a.description === undefined ? 1 : b.description === undefined ? -1 : a.description.toUpperCase() > b.description.toUpperCase() ? -1 : a.description.toUpperCase() < b.description.toUpperCase() ? 1 : 0);
                            });
                    }
                    break;
                case 'Twitter':
                    if (settings.channelCaseSensitive) {
                        if (ChannelController.membersSortingDir === 'A')
                            ChannelController.MembersArray.sort(function (a, b) {
                                return (a.twitter_screen_name === undefined ? 1 : b.twitter_screen_name === undefined ? -1 : a.twitter_screen_name > b.twitter_screen_name ? 1 : a.twitter_screen_name < b.twitter_screen_name ? -1 : 0);
                            });
                        else
                            ChannelController.MembersArray.sort(function (a, b) {
                                return (a.twitter_screen_name === undefined ? 1 : b.twitter_screen_name === undefined ? -1 : a.twitter_screen_name > b.twitter_screen_name ? -1 : a.twitter_screen_name < b.twitter_screen_name ? 1 : 0);
                            });
                    }
                    else
                    {
                        if (ChannelController.membersSortingDir === 'A')
                            ChannelController.MembersArray.sort(function (a, b) {
                                return (a.twitter_screen_name === undefined ? 1 : b.twitter_screen_name === undefined ? -1 : a.twitter_screen_name.toUpperCase() > b.twitter_screen_name.toUpperCase() ? 1 : a.twitter_screen_name.toUpperCase() < b.twitter_screen_name.toUpperCase() ? -1 : 0);
                            });
                        else
                            ChannelController.MembersArray.sort(function (a, b) {
                                return (a.twitter_screen_name === undefined ? 1 : b.twitter_screen_name === undefined ? -1 : a.twitter_screen_name.toUpperCase() > b.twitter_screen_name.toUpperCase() ? -1 : a.twitter_screen_name.toUpperCase() < b.twitter_screen_name.toUpperCase() ? 1 : 0);
                            });
                    }
                    break;
                case 'Invited':
                    if (ChannelController.membersSortingDir === 'A')
                        ChannelController.MembersArray.sort(function (a, b) { return (a.PendingInviteAt === undefined ? 1 : b.PendingInviteAt === undefined ? -1 : a.PendingInviteAt > b.PendingInviteAt ? 1 : a.PendingInviteAt < b.PendingInviteAt ? -1 : 0); });
                    else
                        ChannelController.MembersArray.sort(function (a, b) { return (a.PendingInviteAt === undefined ? 1 : b.PendingInviteAt === undefined ? -1 : a.PendingInviteAt > b.PendingInviteAt ? -1 : a.PendingInviteAt < b.PendingInviteAt ? 1 : 0); });
                    break;
                case 'Followers':
                    if (ChannelController.membersSortingDir === 'A')
                        ChannelController.MembersArray.sort(function (a, b) { return a.n_followers - b.n_followers; });
                    else
                        ChannelController.MembersArray.sort(function (a, b) { return b.n_followers - a.n_followers; });
                    break;
                case 'Following':
                    if (ChannelController.membersSortingDir === 'A')
                        ChannelController.MembersArray.sort(function (a, b) { return a.n_following - b.n_following; });
                    else
                        ChannelController.MembersArray.sort(function (a, b) { return b.n_following - a.n_following; });
                    break;
                case 'Hearts':
                    if (ChannelController.membersSortingDir === 'A')
                        ChannelController.MembersArray.sort(function (a, b) { return a.n_hearts - b.n_hearts; });
                    else
                        ChannelController.MembersArray.sort(function (a, b) { return b.n_hearts - a.n_hearts; });
                    break;
            }
            membersView.empty();
            ChannelController.displayMembersList(membersView,0);
            ChannelController.updateMemberList(0,ChannelController.MembersArray.length);
        });
    },


    showActions: function() {
        var actionsDiv = $('#channelActions');
        if (!actionsDiv.html()) {
            var refreshButton = $('<a class="btn-small" id="refreshActionsButton">Refresh</a>').click(ChannelController.reloadActions.bind(this));
            var getMoreButton = $('<a class="btn-small" id="getMoreActionsButton">Get More</a>').click(ChannelController.getMoreActions.bind(this));
            var getAllButton = $('<a class="btn-small" id="getAllActionsButton">Get All</a>').click(ChannelController.getAllActions.bind(this));
            var actionsButtons = $('<div class="btn-group"></div>').append(refreshButton, getMoreButton, getAllButton);
            if (settings.channelShowPictures === undefined)
                setSet('channelShowPictures', true);
            var channelShowPicturesChk = $('<input id="channelShowPictures" type="checkbox">').change(function () {
                setSet('channelShowPictures', this.checked);
                ChannelController.refreshActionsList();
            });
            channelShowPicturesChk.prop("checked", settings.channelShowPictures);
            var channelShowPictures = $('<label>Show pictures </label>').prepend(channelShowPicturesChk);
            if (settings.channelLargePictures === undefined)
                setSet('channelLargePictures', false);
            var channelLargePicturesChk = $('<input id="channelLargePictures" type="checkbox">').change(function () {
                setSet('channelLargePictures', this.checked);
                ChannelController.updateActionsList(0, ChannelController.MembersArray.length);
            });
            channelLargePicturesChk.prop("checked", settings.channelLargePictures);
            var channelLargePictures = $('<label>Large pictures   </label>').prepend(channelLargePicturesChk);
            if (settings.channelCaseSensitive === undefined)
                setSet('channelCaseSensitive', true);
            var caseSensitiveChk = $('<input id="channelCaseSensitive" type="checkbox">').change(function () {
                setSet('channelCaseSensitive', this.checked);
                if (ChannelController.actionsSorting === "Name") {
                    ChannelController.actionsSortingDir = (MembershipController.actionsSortingDir === 'D' ? 'A': 'D')
                    ChannelController.sortActionsView(ChannelController.actionsSorting);
                }
            });
            caseSensitiveChk.prop("checked", settings.channelCaseSensitive);
            var caseSensitive = $('<label>Case sensitive sorting   </label>').prepend(caseSensitiveChk);
            var filterAddingChk = $('<input id="channelActionsFilterAdding" type="checkbox">')
                .prop("checked", ChannelController.actionsFilterAdding )
                .change(function () {
                    ChannelController.actionsFilterAdding = this.checked;
                    ChannelController.refreshActionsList();
                });
            var filterAdding = $('<label> Adding </label>').prepend(filterAddingChk);
            var filterRemovingChk = $('<input id="channelActionsFilterRemoving" type="checkbox">')
                .prop("checked", ChannelController.actionsFilterRemoving )
                .change(function () {
                    ChannelController.actionsFilterRemoving = this.checked;
                    ChannelController.refreshActionsList();
                });
            var filterRemoving = $('<label> Removing </label>').prepend(filterRemovingChk);
            var filters = $('<span class="channelActionsFilters right">Filters: </span>')
                .append(filterAdding)
                .append(filterRemoving);

            var actionsView = $('<div id="channelActionsView" />');
            actionsDiv.append(actionsButtons, channelShowPictures, channelLargePictures, caseSensitive, filters, actionsView);
            ChannelController.getActions(false);
        }
    },

    getActions: function(all) {
        if (ChannelController.moreActions) {
            var url_root = 'https://channels.pscp.tv/v1/channels/' + ChannelController.CID + '/actions';
        if (ChannelController.ActionsArray.length && ChannelController.actionsBatchCursor !== "")
                url_root += '?cursor=' + ChannelController.actionsBatchCursor;
            PeriscopeWrapper.V1_GET_ApiChannels(function (response) {
                ChannelController.moreActions = response.HasMore;
                ChannelController.actionsBatchCursor = response.Cursor;
                if (response.Actions.length) {
                    var prevLen = ChannelController.ActionsArray.length;
                    if (prevLen > 0)
                        ChannelController.ActionsArray = ChannelController.ActionsArray.concat(response.Actions);
                    else
                        ChannelController.ActionsArray = response.Actions;
                    if (!all || !response.HasMore) {
                        $('#ActionsSpoilerTitle')[0].innerText = 'Actions (' + ChannelController.ActionsArray.length + (ChannelController.moreActions ? '...' : '') + ')';
                        if (!ChannelController.moreActions) {
                            $('#ChannelActionsViewGetMore').hide();
                            $('#getAllActionsButton').hide();
                            $('#getMoreActionsButton').hide();
                            $('#getMoreActionsBottomButton').hide();
                        }
                        if (prevLen === 0) {
                            var actionsView = $('#channelActionsView');
                            ChannelController.displayActionsList(actionsView, 0);
                        }
                    }
                    else
                        ChannelController.getActions(all);
                    //ChannelController.getUsersForActions(prevLen);
                    ChannelController.updateActionsList(prevLen, ChannelController.ActionsArray.length);
                }
            }, url_root);
        }
    },

    getUsersForActions: function(actionIndex) {
        if (actionIndex < ChannelController.ActionsArray.length) {
            var uids = [];
            //var nUsers = Math.min(100, ChannelController.ActionsArray.length - actionIndex);
            //for (var i = 0; i < nUsers; i++)
            //    uids.push(ChannelController.ActionsArray[i+actionIndex].UserId);
            var nUsers = 0;
            var index = actionIndex;
            while (nUsers < 100 && index < ChannelController.ActionsArray.length) {

            }

            PeriscopeWrapper.V2_POST_Api('users', {user_ids: uids}, function (usersResponse) {
                if (usersResponse.users.length) {
                    for (var u = 0; u < nUsers; u++) {
                        ChannelController.ActionsArray[u + actionIndex].is_banned = true;
                        for (var j in usersResponse.users) {
                            if (usersResponse.users[j].id === ChannelController.ActionsArray[u + actionIndex].UserId) {
                                var pendingInvite = ChannelController.ActionsArray[u + actionIndex].PendingInviteAt;
                                ChannelController.ActionsArray[u + actionIndex] = usersResponse.users[j];
                                ChannelController.ActionsArray[u + actionIndex].UserId = usersResponse.users[j].id;
                                ChannelController.ActionsArray[u + actionIndex].PendingInviteAt = pendingInvite;
                                ChannelController.ActionsArray[u + actionIndex].is_banned = false;
                                break;
                            }
                        }
                    }
                }
                ChannelController.updateActionsList(actionIndex, nUsers);
                if (actionIndex+nUsers < ChannelController.ActionsArray.length)
                    ChannelController.getUsersForActions(actionIndex+nUsers);
            });
        }
    },

    reloadActions: function() {
        $('#refreshActionsButton').addClass('activated');
        ChannelController.ActionsArray = [];
        ChannelController.moreActions = true;
        $('#channelActionsView').empty();
        $('#ChannelActionsViewGetMore').show();
        $('#getAllActionsButton').show();
        $('#getMoreActionsButton').show();
        $('#getMoreActionsBottomButton').show();
        ChannelController.getActions(false);
    },

    getMoreActions: function() {
        $('#getMoreActionsButton').addClass('activated');
        $('#getMoreActionsBottomButton').addClass('activated');
        ChannelController.getActions(false);
    },

    getAllActions: function() {
        var btn = $('#getAllActionsButton');
        btn.addClass('activated');
        if (ChannelController.Channel.NMember === 1000) {
            if (confirm('The group ' + ChannelController.CID + ' ' + ChannelController.Channel.Name + ' is reporting to have 1000 or more members. Are you sure you want get ALL actions? This could take really long time...'))
                ChannelController.getActions(true);
        }
        else
            ChannelController.getActions(true);
    },

    displayActionsList: function(container, position) {
        //console.log('displayActionsList( ' +  position + ' ) / ' + ChannelController.ActionsArray.length );
        if (ChannelController.ActionsArray && ChannelController.ActionsArray.length) {
            if (!container.html()) {
                var colHeader1  = $('<th><span class="table-sprites ' + (ChannelController.actionsSorting === 'Time' ? (ChannelController.actionsSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span>Time</span></th>').click(ChannelController.sortActionsView.bind(this, 'Time'));
                var colHeader2  = $('<th><span class="table-sprites ' + (ChannelController.actionsSorting === 'UserId' ? (ChannelController.actionsSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span>UserId</span></th>').click(ChannelController.sortActionsView.bind(this, 'UserId'));
                var colHeader3  = $('<th><span class="table-sprites table-sortnone"></span><span>Picture</span></th>');
                var colHeader4  = $('<th><span class="table-sprites ' + (ChannelController.actionsSorting === 'Name' ? (ChannelController.actionsSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span>Name</span></th>').click(ChannelController.sortActionsView.bind(this, 'Name'));
                //var colHeader5  = $('<th><span class="table-sprites ' + (ChannelController.actionsSorting === 'Display Name' ? (ChannelController.actionsSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span>Display name</span></th>').click(ChannelController.sortActionsView.bind(this, 'Display Name'));
                var colHeader6  = $('<th><span class="table-sprites ' + (ChannelController.actionsSorting === 'Action Type' ? (ChannelController.actionsSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span>Action Type</span></th>').click(ChannelController.sortActionsView.bind(this, 'Action Type'));
                var colHeader7  = $('<th><span class="table-sprites ' + (ChannelController.actionsSorting === 'MemberId' ? (ChannelController.actionsSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span>MemberId</span></th>').click(ChannelController.sortActionsView.bind(this, 'MemberId'));
                var colHeader8  = $('<th><span class="table-sprites table-sortnone"></span><span>Member Picture</span></th>');
                //var colHeader9  = $('<th><span class="table-sprites ' + (ChannelController.actionsSorting === 'Created' ? (ChannelController.actionsSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span>Created</span></th>').click(ChannelController.sortActionsView.bind(this, 'Created'));
                var colHeader10 = $('<th><span class="table-sprites ' + (ChannelController.actionsSorting === 'Member Name' ? (ChannelController.actionsSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span>Member Name</span></th>').click(ChannelController.sortActionsView.bind(this, 'Member Name'));
                //var colHeader11 = $('<th><span class="table-sprites ' + (ChannelController.actionsSorting === 'Member Display Name' ? (ChannelController.actionsSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span>Member Display name</span></th>').click(ChannelController.sortActionsView.bind(this, 'Member Display Name'));
                //var colHeader12 = $('<th><span class="table-sprites ' + (ChannelController.actionsSorting === 'Member Followers' ? (ChannelController.actionsSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span title="Member Followers">F</span></th>').click(ChannelController.sortActionsView.bind(this, 'Member Followers'));
                //var colHeader13 = $('<th><span class="table-sprites ' + (ChannelController.actionsSorting === 'Member Following' ? (ChannelController.actionsSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span title="Member Following">F</span></th>').click(ChannelController.sortActionsView.bind(this, 'Member Following'));
                //var colHeader14 = $('<th><span class="table-sprites ' + (ChannelController.actionsSorting === 'Member Hearts' ? (ChannelController.actionsSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span title="Member Hearts">H</span></th>').click(ChannelController.sortActionsView.bind(this, 'Member Hearts'));
                var colHeader15 = $('<th><span class="table-sprites ' + (ChannelController.actionsSorting === 'Broadcast' ? (ChannelController.actionsSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span>Broadcast</span></th>').click(ChannelController.sortActionsView.bind(this, 'Broadcast'));
                var colHeader16 = $('<th><span class="table-sprites ' + (ChannelController.actionsSorting === 'ChannelName' ? (ChannelController.actionsSortingDir === 'A' ? "table-sortasc" : "table-sortdesc") : "table-sortboth") + '"></span><span>Channel Name</span></th>').click(ChannelController.sortActionsView.bind(this, 'ChannelName'));
                //var colHeaderActions = $('<th><span class="table-sprites table-sortnone"></span></th>');
                var tableHeaderRow = $('<tr></tr>>')
                    .append(colHeader1)
                    .append(colHeader2)
                    .append(colHeader3)
                    .append(colHeader4)
                    //.append(colHeader5)
                    .append(colHeader6)
                    .append(colHeader7)
                    .append(colHeader8)
                    //.append(colHeader9)
                    .append(colHeader10)
                    //.append(colHeader11)
                    //.append(colHeader12)
                    //.append(colHeader13)
                    //.append(colHeader14)
                    .append(colHeader15)
                    .append(colHeader16);
                    //.append(colHeaderActions);
                var tableHeader = $('<thead></thead>>').append(tableHeaderRow);
                var table = $('<table id="ChannelActionsTable" class="blueTable"></table>')
                    .append(tableHeader)
                    .append($('<tbody id="ChannelActionsTableBody"></tbody>'));
                var searchInput = $('<input type="text" id="ChannelActionsSearch" placeholder="Type to search..." />').keyup( function () {
                    var searchText = $(this).val().toLowerCase();
                    // Show only matching TR, hide rest of them
                    $.each($("#ChannelActionsTable tbody tr"), function() {
                        if($(this).text().toLowerCase().indexOf(searchText) === -1)
                            $(this).hide();
                        else
                            $(this).show();
                        $(window).trigger('scroll');
                    });
                });
                container.append(searchInput,table);
                if (ChannelController.moreActions) {
                    var getMoreButton = $('<a class="btn-small" id="getMoreActionsBottomButton">Get More</a>').click(ChannelController.getMoreActions.bind(this));
                    var actionsButtons = $('<div id="ChannelActionsViewGetMore" class="btn-group"></div>').append(getMoreButton );
                    container.append(actionsButtons);
                }
            }
            //ChannelController.updateActionsList(position, ChannelController.ActionsArray.length)
        }
        else
            container.html('No results');
    },

    updateActionsList: function(actionIndex, nActions) {
        var pheight = settings.channelLargePictures ? 64 : 32;
        for (var i = actionIndex; i < ChannelController.ActionsArray.length && i < actionIndex + nActions; i++) {
            // TODO: display array with paging
            var action = ChannelController.ActionsArray[i];
            if (!ChannelController.actionsFilterAdding && action.ActionType === 'a')
                continue;
            if (!ChannelController.actionsFilterRemoving && action.ActionType === 'r')
                continue;

            /*
            var buttons = $('<td class="memberActions text-right"></td>')
                .append($('<div class="btn-group"></div>'));
            if (!ChannelController.Channel.RestrictMembersManagement || ChannelController.Channel.OwnerId === loginTwitter.user.id) {
                buttons.append($('<button type="submit" class="btn btn-secondary btn-sm"><i class="fas fa-running"></i><span class="d-none d-md-inline">Kick</span></button>')
                    .click(ChannelController.leaveChannel.bind(this, member)));
            }
            var btnflw = (member.is_following ?
                $('<button type="submit" class="btn btn-info btn-sm activated fixed-width-80"><i class="fas fa-file-signature"></i><span class="d-none d-md-inline">Unfollow</span></button>') :
                $('<button type="submit" class="btn btn-primary btn-sm fixed-width-80"><i class="fas fa-file-signature"></i><span class="d-none d-md-inline">Follow</span></button>'));
            btnflw.click(ChannelController.followMemberToggle.bind(this, member, btnflw));
            buttons.append(btnflw);
            var btnblk = (member.is_blocked ?
                $('<button type="submit" class="btn btn-warning btn-sm fixed-width-75"><i class="fas fa-undo-alt"></i><span class="d-none d-md-inline">Unblock</span></button>') :
                $('<button type="submit" class="btn btn-danger btn-sm fixed-width-75"><i class="fas fa-trash-alt"></i><span class="d-none d-md-inline">Block</span></button>'));
            btnblk.click(ChannelController.blockMemberToggle.bind(this, member, btnblk));
            buttons.append(btnblk);
            */
            var user_id = $('<td class="actionUserId"><a>' + action.ById + '</a></td>').click(switchSection.bind(null, 'User', action.ById));
            var member_id = $('<td class="actionMemberId"><a>' + (action.MemberId !== action.ById ? action.MemberId : '' )+ '</a></td>').click(switchSection.bind(null, 'User', action.MemberId));
            var user_picture = $('<td class="actionUserPicture"></td>');
            var member_picture = $('<td class="actionMemberPicture"></td>');
            if (settings.channelShowPictures) {
                if (action.user && action.user.profile_image_urls && action.user.profile_image_urls.length)
                    user_picture.append('<a href="' + (action.user.profile_image_urls[action.user.profile_image_urls.length - 1].url.includes("googleusercontent.com/") ?
                        action.user.profile_image_urls[action.user.profile_image_urls.length - 1].url.replace("s96-c", "s0") :
                        action.user.profile_image_urls[0].url)
                        + '" target="_blank"><img class="avatar" height="' + pheight + '" lazysrc="' + action.user.profile_image_urls[action.user.profile_image_urls.length - 1].url + '"></a>');
                else
                    user_picture.append('<img class="avatar" height="' + pheight + '"/>');
                if (action.member && action.ById !== action.MemberId && action.member.profile_image_urls && action.member.profile_image_urls.length)
                    member_picture.append('<a href="' + (action.member.profile_image_urls[action.member.profile_image_urls.length - 1].url.includes("googleusercontent.com/") ?
                        action.member.profile_image_urls[action.member.profile_image_urls.length - 1].url.replace("s96-c", "s0") :
                        action.member.profile_image_urls[0].url)
                        + '" target="_blank"><img class="avatar" height="' + pheight + '" lazysrc="' + action.member.profile_image_urls[action.member.profile_image_urls.length - 1].url + '"></a>');
                else
                    member_picture.append('<img class="avatar" height="' + pheight + '"/>');
            }
            var user_name = (action.user ?
                (action.user.is_banned ?
                $('<td class="actionUserName">' + '(banned)' + '</td>').click(switchSection.bind(null, 'User', action.ById)) :
                $('<td class="actionUserName"><a>' + (action.user.username ? action.user.username : '') + '</a></td>').click(switchSection.bind(null, 'User', action.ById))) :
                $('<td class="actionUserName"></td>') );
            var member_name = (action.member && action.ById !== action.MemberId ?
                (action.member.is_banned ?
                    $('<td class="actionMemberName">' + '(banned)' + '</td>').click(switchSection.bind(null, 'User', action.MemberId)) :
                    $('<td class="actionMemberName"><a>' + (action.member.username ? action.member.username : '') + '</a></td>').click(switchSection.bind(null, 'User', action.MemberId))) :
                $('<td class="actionMemberName"></td>') );
            var broadcast = (action.BroadcastId ?
                $('<td class="actionMemberBroadcast"><a>' + action.BroadcastId + '</a></td>' ).click(switchSection.bind(null, 'Broadcast', action.BroadcastId)) :
                $('<td class="actionMemberBroadcast"></td>') );
            var table_row = $('#A_' + action.Time);
            if (table_row)
                table_row.remove();
            $('#ChannelActionsTableBody').append($('<tr id="A_' + action.Time + '">')
                .append($('<td class="actionTime">' + formatDate(new Date(action.Time)) + '</td>'))
                .append(user_id)
                .append(user_picture)
                .append(user_name)
                //.append($('<td class="actionUserDisplayName">' + (action.user && action.user.display_name ? emoji_to_img(action.user.display_name) : '') + '</td>'))
                .append($('<td class="actionType">' + ChannelController.decodeAction(action) + '</td>'))
                .append(member_id)
                .append(member_picture)
                //.append($('<td class="actionMemberCreated">' + (action.member && action.member.created_at ? formatDate(new Date(action.member.created_at)) : '') + '</td>'))
                .append(member_name)
                //.append($('<td class="actionMemberDisplayName">' + (action.member && action.member.display_name ? emoji_to_img(action.member.display_name) : '') + '</td>'))
                //.append($('<td class="actionMemberFollowers">' + (action.member && action.member.n_followers ? action.member.n_followers : 0) + '</td>'))
                //.append($('<td class="actionMemberFollowing">' + (action.member && action.member.n_following ? action.member.n_following : 0) + '</td>'))
                //.append($('<td class="actionMemberHearts">' + (action.member && action.member.n_hearts ? action.member.n_hearts : 0) + '</td>'))
                .append(broadcast)
                .append($('<td class="actionChannelName">' + (action.ChannelName ? action.ChannelName : '') + '</td>'))
                //.append(buttons)
            );
        }
        $('#getMoreActionsButton').removeClass('activated');
        $('#getMoreActionsBottomButton').removeClass('activated');
        $('#getAllActionsButton').removeClass('activated');
        $('#refreshActionsButton').removeClass('activated');
        $(window).trigger('scroll');
    },

    decodeAction: function(action) {
        var actionName = action.ActionType;
        switch (action.ActionType) {
            case 'a':
                actionName = "Added member";
                break;
            case 'c':
                actionName = "Created group";
                break;
            case 'b':
                actionName = "Broadcasted";
                break;
            case 's':
                actionName = "Shared broadcast";
                break;
            case 'r':
                if (action.ById === action.MemberId)
                    actionName = "Left the group";
                else
                    actionName = "Removed member";
                break;
            case 'u':
                actionName = "Renamed group";
                break;
        }
        return actionName;
    },

    refreshActionsList: function() {
        var actionsView = $('#channelActionsView');
        actionsView.empty();
        ChannelController.displayActionsList(actionsView,0);
        ChannelController.updateActionsList(0,ChannelController.ActionsArray.length);
    },

    sortActionsView: function(col) {
        if (col === ChannelController.actionsSorting ) {
            ChannelController.actionsSortingDir = (ChannelController.actionsSortingDir === 'D' ? 'A' : 'D');
        }
        else {
            ChannelController.actionsSorting = col;
            ChannelController.actionsSortingDir = (col === 'Created' || col === 'Invited' || col === 'Followers' || col === 'Following' || col === 'Hearts' ? 'D' : 'A');
        }
        var actionsView = $('#channelActionsView');
        actionsView.empty();
        actionsView.append($('<h3>Sorting......</h3>'));
        actionsView.ready(function () {
            switch (ChannelController.actionsSorting) {
                case 'UserId':
                    if (ChannelController.actionsSortingDir === 'A')
                        ChannelController.ActionsArray.sort(function (a, b) { return (a.UserId > b.UserId ? 1 : a.UserId < b.UserId ? -1 : 0); });
                    else
                        ChannelController.ActionsArray.sort(function (a, b) { return (a.UserId > b.UserId ? -1 : a.UserId < b.UserId ? 1 : 0); });
                    break;
                case 'Created':
                    if (ChannelController.actionsSortingDir === 'A')
                        ChannelController.ActionsArray.sort(function (a, b) { return (a.created_at === undefined ? 1 : b.created_at === undefined ? -1 : a.created_at > b.created_at ? 1 : a.created_at < b.created_at ? -1 : 0); });
                    else // intentionally leave banned users always at the end of list
                        ChannelController.ActionsArray.sort(function (a, b) { return (a.created_at === undefined ? 1 : b.created_at === undefined ? -1 : a.created_at > b.created_at ? -1 : a.created_at < b.created_at ? 1 : 0); });
                    break;
                case 'Name':
                    if (settings.channelCaseSensitive) {
                        if (ChannelController.actionsSortingDir === 'A')
                            ChannelController.ActionsArray.sort(function (a, b) {
                                return (a.username === undefined ? 1 : b.username === undefined ? -1 : a.username > b.username ? 1 : a.username < b.username ? -1 : 0);
                            });
                        else
                            ChannelController.ActionsArray.sort(function (a, b) {
                                return (a.username === undefined ? 1 : b.username === undefined ? -1 : a.username > b.username ? -1 : a.username < b.username ? 1 : 0);
                            });
                    }
                    else
                    {
                        if (ChannelController.actionsSortingDir === 'A')
                            ChannelController.ActionsArray.sort(function (a, b) {
                                return (a.username === undefined ? 1 : b.username === undefined ? -1 : a.username.toUpperCase() > b.username.toUpperCase() ? 1 : a.username.toUpperCase() < b.username.toUpperCase() ? -1 : 0);
                            });
                        else
                            ChannelController.ActionsArray.sort(function (a, b) {
                                return (a.username === undefined ? 1 : b.username === undefined ? -1 : a.username.toUpperCase() > b.username.toUpperCase() ? -1 : a.username.toUpperCase() < b.username.toUpperCase() ? 1 : 0);
                            });
                    }
                    break;
                case 'Display Name':
                    if (settings.channelCaseSensitive) {
                        if (ChannelController.actionsSortingDir === 'A')
                            ChannelController.ActionsArray.sort(function (a, b) {
                                return (a.display_name === undefined ? 1 : b.display_name === undefined ? -1 : a.display_name > b.display_name ? 1 : a.display_name < b.display_name ? -1 : 0);
                            });
                        else
                            ChannelController.ActionsArray.sort(function (a, b) {
                                return (a.display_name === undefined ? 1 : b.display_name === undefined ? -1 : a.display_name > b.display_name ? -1 : a.display_name < b.display_name ? 1 : 0);
                            });
                    }
                    else
                    {
                        if (ChannelController.actionsSortingDir === 'A')
                            ChannelController.ActionsArray.sort(function (a, b) {
                                return (a.display_name === undefined ? 1 : b.display_name === undefined ? -1 : a.display_name.toUpperCase() > b.display_name.toUpperCase() ? 1 : a.display_name.toUpperCase() < b.display_name.toUpperCase() ? -1 : 0);
                            });
                        else
                            ChannelController.ActionsArray.sort(function (a, b) {
                                return (a.display_name === undefined ? 1 : b.display_name === undefined ? -1 : a.display_name.toUpperCase() > b.display_name.toUpperCase() ? -1 : a.display_name.toUpperCase() < b.display_name.toUpperCase() ? 1 : 0);
                            });
                    }
                    break;
                case 'Description':
                    if (settings.channelCaseSensitive) {
                        if (ChannelController.actionsSortingDir === 'A')
                            ChannelController.ActionsArray.sort(function (a, b) {
                                return (a.description === undefined ? 1 : b.description === undefined ? -1 : a.description > b.description ? 1 : a.description < b.description ? -1 : 0);
                            });
                        else
                            ChannelController.ActionsArray.sort(function (a, b) {
                                return (a.description === undefined ? 1 : b.description === undefined ? -1 : a.description > b.description ? -1 : a.description < b.description ? 1 : 0);
                            });
                    }
                    else
                    {
                        if (ChannelController.actionsSortingDir === 'A')
                            ChannelController.ActionsArray.sort(function (a, b) {
                                return (a.description === undefined ? 1 : b.description === undefined ? -1 : a.description.toUpperCase() > b.description.toUpperCase() ? 1 : a.description.toUpperCase() < b.description.toUpperCase() ? -1 : 0);
                            });
                        else
                            ChannelController.ActionsArray.sort(function (a, b) {
                                return (a.description === undefined ? 1 : b.description === undefined ? -1 : a.description.toUpperCase() > b.description.toUpperCase() ? -1 : a.description.toUpperCase() < b.description.toUpperCase() ? 1 : 0);
                            });
                    }
                    break;
                case 'Twitter':
                    if (settings.channelCaseSensitive) {
                        if (ChannelController.actionsSortingDir === 'A')
                            ChannelController.ActionsArray.sort(function (a, b) {
                                return (a.twitter_screen_name === undefined ? 1 : b.twitter_screen_name === undefined ? -1 : a.twitter_screen_name > b.twitter_screen_name ? 1 : a.twitter_screen_name < b.twitter_screen_name ? -1 : 0);
                            });
                        else
                            ChannelController.ActionsArray.sort(function (a, b) {
                                return (a.twitter_screen_name === undefined ? 1 : b.twitter_screen_name === undefined ? -1 : a.twitter_screen_name > b.twitter_screen_name ? -1 : a.twitter_screen_name < b.twitter_screen_name ? 1 : 0);
                            });
                    }
                    else
                    {
                        if (ChannelController.actionsSortingDir === 'A')
                            ChannelController.ActionsArray.sort(function (a, b) {
                                return (a.twitter_screen_name === undefined ? 1 : b.twitter_screen_name === undefined ? -1 : a.twitter_screen_name.toUpperCase() > b.twitter_screen_name.toUpperCase() ? 1 : a.twitter_screen_name.toUpperCase() < b.twitter_screen_name.toUpperCase() ? -1 : 0);
                            });
                        else
                            ChannelController.ActionsArray.sort(function (a, b) {
                                return (a.twitter_screen_name === undefined ? 1 : b.twitter_screen_name === undefined ? -1 : a.twitter_screen_name.toUpperCase() > b.twitter_screen_name.toUpperCase() ? -1 : a.twitter_screen_name.toUpperCase() < b.twitter_screen_name.toUpperCase() ? 1 : 0);
                            });
                    }
                    break;
                case 'Invited':
                    if (ChannelController.actionsSortingDir === 'A')
                        ChannelController.ActionsArray.sort(function (a, b) { return (a.PendingInviteAt === undefined ? 1 : b.PendingInviteAt === undefined ? -1 : a.PendingInviteAt > b.PendingInviteAt ? 1 : a.PendingInviteAt < b.PendingInviteAt ? -1 : 0); });
                    else
                        ChannelController.ActionsArray.sort(function (a, b) { return (a.PendingInviteAt === undefined ? 1 : b.PendingInviteAt === undefined ? -1 : a.PendingInviteAt > b.PendingInviteAt ? -1 : a.PendingInviteAt < b.PendingInviteAt ? 1 : 0); });
                    break;
                case 'Followers':
                    if (ChannelController.actionsSortingDir === 'A')
                        ChannelController.ActionsArray.sort(function (a, b) { return a.n_followers - b.n_followers; });
                    else
                        ChannelController.ActionsArray.sort(function (a, b) { return b.n_followers - a.n_followers; });
                    break;
                case 'Following':
                    if (ChannelController.actionsSortingDir === 'A')
                        ChannelController.ActionsArray.sort(function (a, b) { return a.n_following - b.n_following; });
                    else
                        ChannelController.ActionsArray.sort(function (a, b) { return b.n_following - a.n_following; });
                    break;
                case 'Hearts':
                    if (ChannelController.actionsSortingDir === 'A')
                        ChannelController.ActionsArray.sort(function (a, b) { return a.n_hearts - b.n_hearts; });
                    else
                        ChannelController.ActionsArray.sort(function (a, b) { return b.n_hearts - a.n_hearts; });
                    break;
            }
            ChannelController.refreshActionsList();
            //actionsView.empty();
            //ChannelController.displayActionsList(actionsView,0);
            //ChannelController.updateActionsList(0,ChannelController.ActionsArray.length);
        });
    }

};
