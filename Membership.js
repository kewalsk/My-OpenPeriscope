// [kewalsk] TODO: Still have no idea how it is working :(

// TODO: Get More button should be active only if last response HasMore is true
// TODO: Add fields: date of creation, date of last activity, date of adding, owner @username & displayName (detect banned owners), CID
// TODO: Sort by all above
// TODO: Handle refresh on load
// TODO: Don't reset list on open (only on refresh button click)

var MembershipController = {
    init: function(parent) {
        var refreshButton = $('<a class="button" id="refreshMembership">Refresh</a>').click(
            MembershipController.load_data.bind(this)
        );
        var getMoreButton = $('<a class="button" id="getMoreGroups">Get more</a>').click(
            MembershipController.load_more_data.bind(this)
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
                MembershipController.load_data();
            });
    },

    add_channel: function (spoilerContent, channel, buttons) {
        // TODO: Display groups in table
        var PrivateChannelName = $('<a class="groupNameContainer"><span class="groupNameTitle">Name: </span><span class="groupName">' + emoji.replace_unified(channel.Name) + '</span>' + '</a>');
        var channel_description = $('<div class="groupCard description" cName="' + channel.Name + '" cid="' + channel.CID + '"/>').click(switchSection.bind(null, 'Channel', channel.CID))
            .append(
                '<div class="group_broadcasts_indicator right icon" title="Lives / Replays">' + 'Group lives and shares ' + channel.NLive + ' / ' + (channel.NReplay || 0) + '</div>',
                PrivateChannelName, '<br>',
                buttons,
                'Members: ', '<span>' + channel.NMember + '</span>', '<br/>'
            );

        spoilerContent.append(channel_description);
        return channel_description;
    },

    load_channel_membership: function(spoilerContent) {
        var channels_url_root = 'https://channels.pscp.tv/v1/users/' + loginTwitter.user.id + '/channels';
        PeriscopeWrapper.V1_GET_ApiChannels(function (response) {
            if (response.Channels) {
                for (var i in response.Channels) {
                    var owner_id =  response.Channels[i].OwnerId;
                    var buttonDiv = $('<div class="leave_button_div right">')
                        .append($('<a class="button leaveGroup">leave</a>'));
                    var channel_description = MembershipController.add_channel(spoilerContent, response.Channels[i], buttonDiv);

                    channel_description
                        .append('Owner: ', $('<a>' + owner_id + '</a>').click(switchSection.bind(null, 'User', owner_id)), '<br/>')

                    $(window).trigger('scroll');    // for lazy load
                }
            } else {
                spoilerContent.html('No results');
            }
            MembershipController.set_title_groups(response.Channels.length, response.HasMore ); // TODO: replace to length + retrieved before
        }, channels_url_root);
    },

    reset_view: function() {
        $('#GroupMembership').empty();
        MembershipController.set_title_retrieving();
    },

    set_title_retrieving: function() {
        $('#GroupMembershipTitle')[0].innerText = "Groups - retrieving the data...";
    },

    set_title_groups: function(totalChannels, more) {
        $('#GroupMembershipTitle')[0].innerText =  totalChannels + (more ? " and still more" : "" ) + " groups";
    },

    load_more_data: function () {

        MembershipController.set_title_retrieving();
        MembershipController.load_channel_membership($('#GroupMembership'));
    },

    load_data: function () {

        //MembershipController.reset_view();
        MembershipController.set_title_retrieving();
        MembershipController.load_channel_membership($('#GroupMembership'));
    }
};
