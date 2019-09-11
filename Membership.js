// TODO: Get More button should be active only if last response HasMore is true
// TODO: Add fields: owner @username & displayName (detect banned owners)
// TODO: Sort by columns
// TODO: Handle refresh on load
// TODO: Option to view as list or table (in user settings)

var MembershipController = {
    channelsArray: [],
    moreChannels: true,
    batchCursor: "",

    init: function(parent) {
        $('#GroupMembership').remove();
        var refreshButton = $('<a class="button" id="refreshMembership">Refresh</a>').click(
            MembershipController.resetAndLoadData.bind(this)
        );
        var getMoreButton = $('<a class="button" id="getMoreGroups">Get more</a>').click(
                MembershipController.loadMoreData.bind(this)
        );
        var createChannelButton = $('<a class="button" id="createGroup">Create new</a>').click(function () { window.alert("Not yet implemented"); });
        if (!settings.refreshMembershipOnLoad)
            setSet('refreshMembershipOnLoad', false);

        var refreshOnLoadBtn = $('<input id="refreshMembershipOnLoad" type="checkbox">').change(function () {
            setSet('refreshMembershipOnLoad', this.checked);
        });
        refreshOnLoadBtn.prop("checked", settings.refreshMembershipOnLoad);
        var refreshOnLoad = $('<label>Refresh on load  </label>').prepend(refreshOnLoadBtn);
        var groupMembershipTitle = $('<h3 id="GroupMembershipTitle" >Group membership loading ...</h3>');
        var groupMembershipContainer = $('<div id="GroupMembershipContainer" class="table-responsive"></div>');
        var membershipDiv = $('<div id="GroupMembership"/>').append(refreshButton, getMoreButton, createChannelButton, refreshOnLoad, groupMembershipTitle, groupMembershipContainer);
        parent.append(membershipDiv).ready(function () {
                if (!MembershipController.channelsArray || MembershipController.channelsArray.length === 0)
                    MembershipController.loadData();
                else
                    MembershipController.displayData();
            });
    },

    displayData: function() {
        if (MembershipController.channelsArray && MembershipController.channelsArray.length > 0) {
            MembershipController.setTitle(MembershipController.channelsArray.length, MembershipController.moreChannels);
            MembershipController.appendTableView();
            for (var i in MembershipController.channelsArray) {
                // TODO: display array with paging
                MembershipController.addChannelTableView($('#GroupMembershipTable'), MembershipController.channelsArray[i]);
            }
            $(window).trigger('scroll');    // for lazy load
        }
        else
            $('#GroupMembershipContainer').html('No results');
    },

    changeView: function(asList) {
        if (asList)
            window.alert("Change to list view is not implemented (yet).");
    },

    formatDate: function(date) {
        var d = new Date(date),
            month = '' + (d.getMonth() + 1),
            day = '' + d.getDate(),
            year = d.getFullYear();
        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;
        return [year, month, day].join('-')  + ' ' +  date.toLocaleTimeString();
    },

    renameChannel: function(CID, cName) {
        window.alert("Channel CID " + CID + " rename is not implemented yet.");
    },

    addChannelMembers: function(CID, cName) {
        window.alert("Channel CID " + CID + " add members is not implemented yet.");
    },

    leaveChannel: function(CID, cName) {
        if (confirm('Are you sure you want to leave the group ' + CID + ' ' + cName + '?')) {
            PeriscopeWrapper.V1_ApiChannels(
                function (response) {
                    window.alert("You have been deleted from channel " + CID + " " + cName );
                    MembershipController.removeChannelTableView(CID);
                },
                "https://channels.pscp.tv/v1/channels/" + CID + "/members/" + loginTwitter.user.id,
                null,
                null,
                "DELETE"
            );
        }
    },

    deleteChannel: function(CID, cName) {
        if (confirm('Are you sure you want to delete group ' + CID + ' ' + cName + '?')) {
            PeriscopeWrapper.V1_ApiChannels(
                function (response) {
                    window.alert("Group " + CID + " " + cName + " successfully deleted.");
                    MembershipController.removeChannelTableView(CID);
                },
                "https://channels.pscp.tv/v1/channels/" + CID,
                null,
                null,
                "DELETE"
            );
        }
    },

    appendTableView: function() {
        var groupMembershipTable = $(
            '<table id="GroupMembershipTable" class="membershipTable">'+
            '<thead><tr>'+
            '<th><span class="table-sprites table-sortboth"></span><span>CID</span></th>'+
            '<th><span class="table-sprites table-sortboth"></span><span>&#128272;</span></th>'+
            '<th><span class="table-sprites table-sortboth"></span><span>Created</span></th>'+
            '<th><span class="table-sprites table-sortboth"></span><span>Name</span></th>'+
            '<th><span class="table-sprites table-sortboth"></span><span>Members</span></th>'+
            '<th><span class="table-sprites table-sortboth"></span><span>Lives</span></th>'+
            '<th><span class="table-sprites table-sortasc"></span><span>Last Activity</span></th>'+
            '<th><span class="table-sprites table-sortboth"></span><span>Owner</span></th>'+
            '<th></th>' +
            '</tr></thead>'+
            '<tbody></tbody></table>');
        $('#GroupMembershipContainer').empty();
        $('#GroupMembershipContainer').append(groupMembershipTable);
    },

    addChannelTableView: function (content, channel) {
        var channel_cid = $('<td class="channelCID"><a>' + channel.CID + '</a></td>').click(switchSection.bind(null, 'Channel', channel.CID));
        var channel_owner = $('<td class="channelOwner"><a>' + channel.OwnerId + '</a></td>').click(switchSection.bind(null, 'User', channel.OwnerId));
        var channel_buttons = $('<td class="text-right"></td>')
            .append($('<div class="btn-group"></div>'));
        channel_buttons.append($('<button type="submit" class="btn btn-secondary btn-sm"><i class="fas fa-running"></i><span class="d-none d-md-inline"> Leave</span></button>')
            .click(MembershipController.leaveChannel.bind(this, channel.CID, channel.Name)));
        if (!channel.RestrictMembersManagement) {
            channel_buttons.append($('<button type="submit" class="btn btn-primary btn-sm"><i class="fas fa-file-signature"></i><span class="d-none d-md-inline"> Rename</span></button>')
                .click(MembershipController.renameChannel.bind(this, channel.CID, channel.Name)));
            channel_buttons.append($('<button type="submit" class="btn btn-info btn-sm"><i class="fas fa-user-plus"></i><span class="d-none d-md-inline"> Add</span></button>')
                .click(MembershipController.addChannelMembers.bind(this, channel.CID, channel.Name)));
            channel_buttons.append($('<button type="submit" class="btn btn-danger btn-sm"><i class="fas fa-trash-alt" aria-hidden="true"></i><span class="d-none d-md-inline"> Delete</span></button>')
                .click(MembershipController.deleteChannel.bind(this, channel.CID, channel.Name)));
        }
        var createdDate = new Date(channel.CreatedAt);
        var lastActivityDate = new Date(channel.LastActivity);
        var restricted = channel.RestrictMembersManagement ? '<td class="channelRestricted">&#128272;</td>' : '<td class="channelRestricted"></td>';

        content.append($('<tr id="CID'+channel.CID+'row">')
            .append(channel_cid)
            .append($(restricted))
            .append($('<td class="channelCreated">' + this.formatDate(createdDate) + '</td>'))
            .append($('<td class="channelName">' + emoji.replace_unified(channel.Name) + '</td>'))
            .append($('<td class="channelNMembers">' + (channel.NMember === 1000 ? '>=' : '' ) + channel.NMember + '</td>'))
            .append($('<td class="channelNLive">' + channel.NLive + '</td>'))
            .append($('<td class="channelLastActivity">' + this.formatDate(lastActivityDate) + '</td>'))
            .append(channel_owner)
            .append(channel_buttons)
        );
    },

    removeChannelTableView: function(CID) {
        var index = MembershipController.channelsArray.findIndex(function (c) { return c.CID === CID });
        if (index > -1) {
            MembershipController.channelsArray.splice(index, 1);
            $('#CID' + CID + 'row').remove();
        }
    },

    getData: function() {
        var channels_url_root = 'https://channels.pscp.tv/v1/users/' + loginTwitter.user.id + '/channels';
        if (MembershipController.moreChannels && MembershipController.batchCursor !== "")
            channels_url_root += '?cursor=' + MembershipController.batchCursor;
        else
            MembershipController.channelsArray = [];
        PeriscopeWrapper.V1_GET_ApiChannels(function (response) {
            if (response.Channels) {
                MembershipController.moreChannels = response.HasMore;
                MembershipController.batchCursor = response.Cursor;
                for (var i in response.Channels)
                    MembershipController.channelsArray.push(response.Channels[i]);
                MembershipController.displayData();
            } else {
                $('#GroupMembershipContainer').html('No results');
            }
            MembershipController.setTitle(MembershipController.channelsArray.length, response.HasMore );
        }, channels_url_root);
    },

    setTitleRetrieving: function() {
        $('#GroupMembershipTitle')[0].innerText = "Groups - retrieving the data...";
    },

    setTitle: function(totalChannels, more) {
        $('#GroupMembershipTitle')[0].innerText =  totalChannels + (more ? " and still more" : " total" ) + " groups";
    },

    resetAndLoadData: function () {
        MembershipController.channelsArray = [];
        MembershipController.moreChannels = true;
        MembershipController.batchCursor = "";
        $('#GroupMembershipTable').remove();
        MembershipController.loadData();
    },

    loadData: function () {
        MembershipController.setTitleRetrieving();
        MembershipController.getData();
    },

    loadMoreData: function () {
        if (MembershipController.moreChannels)
            MembershipController.loadData();
        else
            window.alert("No more channels to get!");
    }
};
