// Controller class to handle list of users for:
// - adding as new members (following and followers and not current members)
// - showing channel members

var ChannelMembersController = {
    usersArray: [],
    moreUsers: true,
    batchCursor: "",
    whatToShow: "users", // "users" or "members"
    channelID: "",

    init: function(container, CID, what) {
        this.whatToShow = what;
        this.channelID = CID;
        container.empty();
        var okButton = $('<a class="button" id="okButton">OK</a>').click(
            ChannelMembersController.assignMembers.bind(this)
        );
        var refreshButton = $('<a class="button" id="refreshButton">Refresh</a>').click(
            ChannelMembersController.reloadData.bind(this)
        );
        var selectAllButton = $('<a class="button" id="selectAllButton">Select All</a>').click(
            ChannelMembersController.selectAll.bind(this)
        );
        var unselectAllButton = $('<a class="button" id="unselectAllButton">Unselect All</a>').click(
            ChannelMembersController.unselectAll.bind(this)
        );
        var membersButtons = $('<div class="btn-group"></div>').append(okButton, refreshButton, selectAllButton, unselectAllButton );
        var membersTitle = $('<h3 id="ChannelMembersTitle" >...</h3>');
        var membersContainer = $('<div id="ChannelMembersContainer" class="table-responsive"></div>');
        var membersView = $('<div id="ChannelMembersView" class="ChannelMembers"></div>')
            .append(membersButtons, membersTitle, membersContainer);
        container.append(membersView).ready(function () {
            ChannelMembersController.loadData();
        });
    },

    displayData: function () {

        if (this.usersArray && this.usersArray.length > 0) {
            $('#ChannelMembersTitle')[0].innerText = this.whatToShow === "users" ?
                "Select users ("+this.usersArray.length+") to add into channel "+this.channelID :
                "Members ("+this.usersArray.length+")";
            ChannelMembersController.appendTableView();
            for (var i in this.usersArray) {
                ChannelMembersController.addUserToTableView($('#ChannelMembersTable'), this.usersArray[i]);
            }
            $(window).trigger('scroll');    // for lazy load
        }
        else
            $('#ChannelMembersTitle')[0].innerText ='No results';
    },

    appendTableView: function() {
        var channelMembersTable = $(
            '<table id="ChannelMembersTable" class="blueTable">'+
            '<thead><tr>'+
            '<th>Selection</th>'+
            '<th><span>Picture</span></th>'+
            '<th><span class="table-sprites table-sortboth"></span><span>Username</span></th>'+
            '<th><span class="table-sprites table-sortboth"></span><span>Display Name</span></th>'+
            '<th><span class="table-sprites table-sortboth"></span><span>Description</span></th>'+
            '<th><span class="table-sprites table-sortboth"></span><span>Created</span></th>'+
            '<th><span class="table-sprites table-sortboth"></span><span>Following</span></th>'+
            '<th><span class="table-sprites table-sortboth"></span><span>Followers</span></th>'+
            (ChannelMembersController.whatToShow === "members" ? '<th><span class="table-sprites table-sortboth"></span><span>Hearts</span></th><th></th>' : '') +
            '</tr></thead>'+
            '<tbody></tbody></table>');
        $('#ChannelMembersContainer').empty().append(channelMembersTable);
    },

    addUserToTableView: function(content, user) {
        user.profile_image_urls.sort(function (a, b) {
            return a.width * a.height - b.width * b.height;
        });
        var user_row = $('<tr id="uid_' + user.id + '">');
        var user_selector = $('<td class="userSelector"></td>');
        user_selector.append('<input id="userSelectorCheckbox" type="checkbox">').change(function () {
            ChannelMembersController.selectUser(this);
        });
        user_selector.prop('checked',user.is_selected );
        var user_picture = $('<td class="userPicture"></td>');
        if (user.profile_image_urls.length)
            user_picture.append('<a href="' + (user.profile_image_urls[0].url.includes("googleusercontent.com/") ?
                user.profile_image_urls[0].url.replace("s96-c", "s0") :
                user.profile_image_urls[user.profile_image_urls.length - 1].url)
                + '" target="_blank"><img class="avatar" height="48" lazysrc="' + user.profile_image_urls[0].url + '"></a>');
        else
            user_picture.append('<img class="avatar" height="48"/>');
        //var user_id = $('<td class="userID"><a>' + user.id+ '</a></td>').click(switchSection.bind(null, 'User', user.id));
        var user_name = $('<td class="userName"><a>' + user.username + '</a></td>').click(switchSection.bind(null, 'User', user.id));
        var user_display_name = $('<td class="userDisplayName">' + emoji.replace_unified(user.display_name) + '</td>');
        var user_description = $('<td class="userDescription">' + emoji.replace_unified(user.description) + '</td>');
        var user_created = $('<td class="userCreated">' + MembershipController.formatDate(new Date(user.created_at)) + '</td>');
        var user_following = $('<td class="userFollowing">' + user.n_following + '</td>');
        var user_followers = $('<td class="userFollowers">' + user.n_followers + '</td>');
        var user_hearts = $('<td class="userHearts">' + user.n_hearts + '</td>');
        if (this.whatToShow === "users")
        {
            user_row.append(user_selector)
                .append(user_picture)
                .append(user_name)
                .append(user_display_name)
                .append(user_description)
                .append(user_created)
                .append(user_following)
                .append(user_followers);
        }
        else
        {
            var user_buttons = $('<td class="text-right"></td>')
                .append($('<div class="btn-group"></div>'));
            /*
            user_buttons.append($('<button type="submit" class="btn btn-secondary btn-sm"><i class="fas fa-running"></i><span class="d-none d-md-inline"> Leave</span></button>')
                .click(MembershipController.leaveChannel.bind(this, channel.CID, channel.Name)));
            user_buttons.append($('<button type="submit" class="btn btn-primary btn-sm"><i class="fas fa-file-signature"></i><span class="d-none d-md-inline"> Rename</span></button>')
                .click(MembershipController.renameChannel.bind(this, channel.CID, channel.Name)));
            user_buttons.append($('<button type="submit" class="btn btn-info btn-sm"><i class="fas fa-user-plus"></i><span class="d-none d-md-inline"> Add</span></button>')
                .click(MembershipController.addChannelMembers.bind(this, channel.CID, channel.Name)));
            user_buttons.append($('<button type="submit" class="btn btn-danger btn-sm"><i class="fas fa-trash-alt" aria-hidden="true"></i><span class="d-none d-md-inline"> Delete</span></button>')
                .click(MembershipController.deleteChannel.bind(this, channel.CID, channel.Name)));
             */
            user_row.append(user_picture)
                .append(user_name)
                .append(user_display_name)
                .append(user_description)
                .append(user_created)
                .append(user_following)
                .append(user_followers)
                .append(user_hearts)
                .append(user_buttons);
        }
        content.append(user_row);
    },

    selectAll: function () {

    },

    unselectAll: function () {

    },

    selectUser: function (object) {
        alert(object.closest('tr').toString());
    },

    assignMembers: function () {
    },

    reloadData: function () {
        this.usersArray = [];
        this.batchCursor = "";
        this.moreUsers = true;
        $('#ChannelMembersContainer').remove();
        ChannelMembersController.loadData();
    },

    loadData: function () {

        if (this.whatToShow === 'users') {
            // get followers filtered on is_following
            // display all
            // get all channel members
            // remove follower if member
            $('#ChannelMembersTitle')[0].innerText = "Followers - retrieving the data...";
            PeriscopeWrapper.V2_POST_Api('followers', {
                user_id: loginTwitter.user.id
            }, function (followers) {
                if (followers.length) {
                    for (var i in followers) {
                        if (followers[i].is_following) {
                            followers[i].is_selected = false;
                            ChannelMembersController.usersArray.push(followers[i]);
                        }
                    }
                    ChannelMembersController.displayData();
                } else {
                    $('#ChannelMembersContainer').html('No results');
                }
            });
        }
        else {
            $('#ChannelMembersTitle')[0].innerText = "Members - retrieving the data...";
            var channels_url_root = 'https://channels.pscp.tv/v1/channels/' + this.channelID + '/members';
            if (this.moreChannels && this.batchCursor !== "")
                channels_url_root += '?cursor=' + this.batchCursor;
            else
                this.usersArray = [];
            PeriscopeWrapper.V1_GET_ApiChannels(function (response) {
                if (response.Channels) {
                    ChannelMembersController.moreChannels = response.HasMore;
                    ChannelMembersController.batchCursor = response.Cursor;
                    for (var i in response.Channels)
                        this.channelsArray.push(response.Channels[i]);
                    ChannelMembersController.displayData();
                } else {
                    $('#ChannelMembersContainer').html('No results');
                }

            }, channels_url_root);
        }

    }

};