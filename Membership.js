// [kewalsk] TODO: Still have no idea how it is working :(

// TODO: No list of broadcasts at all (api gets them and the number is put in title correctly)
// TODO: Get More button should be active only if last response HasMore is true
// TODO: Define displayGroup method and make display groups in table
// TODO: Add fields: date of creation, date of last activity, date of adding, owner @username & displayName (detect banned owners), CID
// TODO: Sort by all above
// TODO: Handle refresh on load

var MembershipController = {
    caller_callback: null,
    init: function(parent, callback) {
        this.caller_callback = callback;
        var refreshButton = $('<a class="button" id="refreshMembership">Refresh</a>').click(
            MembershipController.load_data.bind(this, this.caller_callback)
        );
        var getMoreButton = $('<a class="button" id="getMoreGroups">Get more</a>').click(
            MembershipController.load_more_data.bind(this, this.caller_callback)
        );
        var createChannelButton = $('<a class="button" id="createGroup">Create new</a>').click(function () { window.alert("Not yet implemented"); });
        if (!settings.refreshMembershipOnLoad)
            setSet('refreshMembershipOnLoad', false);
        var refreshOnLoadBtn = $('<input id="refreshMembershipOnLoad" type="checkbox">').change(function () {
            setSet('refreshMembershipOnLoad', this.checked);
        });
        refreshOnLoadBtn.prop("checked", settings.refreshMembershipOnLoad);
        var refreshOnLoad = $('<label/>Refresh on load</label><br>').prepend(refreshOnLoadBtn);
        var groupMembershipTitle = $('<h3 id="GroupMembershipTitle" >Group Memberships</h3>');
        var groupMembershipList = $('<div id="GroupMembership" class="spoiler-content" data-spoiler-link="GroupMembership"/>');
        var membershipDiv = $('<div id="Group membership"/>').append(refreshOnLoad, refreshButton, getMoreButton, createChannelButton, groupMembershipTitle, groupMembershipList);
        parent.append(membershipDiv).ready(function () {
                MembershipController.load_data(callback);
            });
    },
    add_channel: function (channels, channel) {
        channel.ThumbnailURLs.sort(function (a, b) {
            return a.width * a.height - b.width * b.height;
        });
        var Name = $('<a>' + channel.Name + '</a>').click(switchSection.bind(null, 'Channel', channel.CID));
        var PublicTag = $('<a>' + channel.PublicTag + '</a>');
        var PublicChannel = $('<a>' + channel.Name + '</a>');
        channel_description = $('<div class="description"/>')
            .append((
                channel.ThumbnailURLs.length ?
                    '<a href="' + (
                        channel.ThumbnailURLs[0].url.includes("googleusercontent.com/") ?
                            channel.ThumbnailURLs[0].url.replace("s96-c", "s0") : // [kewalsk] ???
                            channel.ThumbnailURLs[channel.ThumbnailURLs.length - 1].url) + '" target="_blank"><img class="avatar" width="128" lazysrc="' + channel.ThumbnailURLs[0].url +
                    '"></a>' :
                    '<img class="avatar" width="128"/>'))
            .append(
                '<div class="lives right icon" title="Lives / Replays">' + channel.NLive + ' / ' + channel.NReplay + '</div>',
                PublicChannel, (channel.Featured ? ' FEATURED<br>' : ''), '<br>',
                (channel.PublicTag ? ['Tags: ', Name, ', ', PublicTag, '<br>'] : ''),
                'Description: ' + channel.Description);
        channels.append(channel_description).append($('<p/><br/><br/><br/><br/><br/>')); // [kewalsk] todo: Display groups in table
        return channel_description;
    },
    load_group_membership: function (channels, loginTwitter) {
        defer = $.Deferred();
        channels.empty();
        var channels_url_root = 'https://channels.pscp.tv/v1/users/' + loginTwitter.user.id + '/channels';
        PeriscopeWrapper.V1_GET_ApiChannels(function (response) {
            if (!response.Channels) {
                defer.resolve();
                return defer;
            }
            for (var i in response.Channels) {
                channel_description = MembershipController.add_channel(channels, response.Channels[i]);
                var channel_members_url = "https://channels.pscp.tv/v1/channels/" + response.Channels[i].CID + "/members/" + loginTwitter.user.id;
                var owner_id = response.Channels[i].OwnerId;
                channel_description
                    .append("<br/>Members: ")
                    .append($('<a>' + response.Channels[i].NMember + '</a>').click(switchSection.bind(null, 'Channel', response.Channels[i].CID)))
                    .append("<br/>Owner: ")
                    .append($('<a>' + owner_id + '</a>').click(switchSection.bind(null, 'User', owner_id)))
                    .append("<br/>")
                    .append($('<a class="button">leave</a>').click(function () {
                        if (confirm('Are you sure you want to leave the group "' + response.Channels[i].Name + '"?')) {
                            PeriscopeWrapper.V1_ApiChannels(
                                function (response) {
                                    MembershipController.load_data(this.caller_callback);
                                },
                                channel_members_url,
                                null,
                                null,
                                "DELETE");
                        }
                    }));
            }
            $('#GroupMembershipTitle')[0].innerText = response.Channels.length + (response.HasMore ? " and more" : "" ) + " groups";
            defer.resolve();
        }, channels_url_root);
        return defer;
    },
    reset_view: function() {
        $('#GroupMembership').empty();
        $('#GroupMembershipTitle')[0].innerText = "Groups - retrieving the data...";
    },
    load_more_data: function (callback) {
        loginTwitter = localStorage.getItem('loginTwitter');
        loginTwitter = JSON.parse(loginTwitter);

        MembershipController.load_group_membership($('#GroupMembership'), loginTwitter)
            .done(function () {
                if (callback)
                    callback();
            });
    },
    load_data: function (callback) {
            loginTwitter = localStorage.getItem('loginTwitter');
            loginTwitter = JSON.parse(loginTwitter);

        MembershipController.reset_view();
        MembershipController.load_group_membership($('#GroupMembership'), loginTwitter)
                        .done(function () {
                            if (callback)
                                callback();
                        });
        }
    }
