// TODO: Make table header fixed
// TODO: Display table with paging
// TODO: Add fields: owner @username & displayName (detect banned owners)
// TODO: Option to view as list or table (in user settings)

var MembershipController = {
    channelsArray: [],
    moreChannels: true,
    batchCursor: "",
    currentSorting: "Last Activity",
    currentSortingDir: "D",

    init: function(parent) {
        $('#GroupMembership').remove();
        var refreshButton = $('<a class="button" id="refreshMembership">Refresh</a>').click(
            MembershipController.resetAndLoadData.bind(this)
        );
        var getMoreButton = $('<a class="button" id="getMoreGroups">Get more</a>').click(
                MembershipController.loadMoreData.bind(this)
        );
        var createChannelButton = $('<a class="button" id="createGroup">Create new</a>').click(function () { window.alert("Not yet implemented"); });
        if (settings.membershipAskLeave === null)
            setSet('membershipAskLeave', true);
        var askLeaveBtn = $('<input id="membershipAskLeave" type="checkbox">').change(function () {
            setSet('membershipAskLeave', this.checked);
        });
        askLeaveBtn.prop("checked", settings.membershipAskLeave);
        var askLeave = $('<label>Confirm group leave  </label>').prepend(askLeaveBtn);
        var groupMembershipTitle = $('<h3 id="GroupMembershipTitle" >Group membership loading ...</h3>');
        var groupMembershipContainer = $('<div id="GroupMembershipContainer" class="table-responsive"></div>');
        var membershipDiv = $('<div id="GroupMembership"/>').append(refreshButton, getMoreButton, createChannelButton, askLeave, groupMembershipTitle, groupMembershipContainer);
        parent.append(membershipDiv).ready(function () {
                if (!MembershipController.channelsArray || MembershipController.channelsArray.length === 0)
                    MembershipController.loadData();
                else
                    MembershipController.displayData();
            });
    },

    displayData: function() {
        if (MembershipController.channelsArray && MembershipController.channelsArray.length > 0) {
            MembershipController.setTitle();
            MembershipController.appendTableView();
            for (var i in MembershipController.channelsArray) {
                // TODO: display array with paging
                MembershipController.addChannelToTableView($('#GroupMembershipTable'), MembershipController.channelsArray[i]);
            }
            $(window).trigger('scroll');    // for lazy load
        }
        else
            $('#GroupMembershipContainer').html('No results');
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
        //window.alert("Channel CID " + CID + " rename is not implemented yet.");
        $('#GroupMembershipTitle')[0].innerText =  "Group " + CID + " (" + cName +")";
        var okButton = $('<a class="button" id="renamegroup">OK</a>').click(function () {
            var newname = $('#group_name').val().trim();
            if (newname) {
                PeriscopeWrapper.V1_ApiChannels(
                    function (response) {
                        var index = MembershipController.channelsArray.findIndex(function (c) { return c.CID === CID });
                        if (index > -1) {
                            MembershipController.channelsArray[index].Name = response.Channel.Name;
                            var row = $('#CID' + CID + 'row');
                            MembershipController.addChannelToTableView(row,response.Channel);
                            //row.remove();
                            MembershipController.displayData();
                        }
                        window.alert("Channel " + CID + " renamed to " + response.Channel.Name );
                    },
                    "https://channels.pscp.tv/v1/channels/" + CID,
                    null,
                    { name: newname },
                    "PATCH"
                );
            }
            else
                window.alert("New name cannot be empty.");
        });
        var nameInput = $('<div id="ChannelName">Enter new group name: <input id="group_name" type="text" size="30" placeholder="group_name"></div>');
        nameInput.append(okButton);
        $('#GroupMembershipContainer').empty().append(nameInput);
    },

    addChannelMembers: function(CID, cName) {
        //window.alert("Channel CID " + CID + " add members is not implemented yet.");
        ChannelMembersController.init($('#GroupMembership'), CID, 'users');
    },

    leaveChannel: function(CID, cName) {
        if (!settings.membershipAskLeave || confirm('Are you sure you want to leave the group ' + CID + ' ' + cName + '?')) {
            PeriscopeWrapper.V1_ApiChannels(
                function (response) {
                    if (NODEJS) // todo: add setting if log leaved groups id and names to blacklist
                    {
                        var fs = require('fs');
                        fs.appendFile(settings.downloadPath + '/' + 'channels_blacklist.txt', CID + ' "' + cName + '"\n',
                            'utf8',function () {});
                    }
                    if (settings.membershipAskLeave)
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
        var colHeader1 = $('<th><span class="table-sprites '+(MembershipController.currentSorting==='CID'?(MembershipController.currentSortingDir==='A'?"table-sortasc":"table-sortdesc"):"table-sortboth")+'"></span><span>CID</span></th>').click(MembershipController.sortView.bind(this, 'CID'));
        var colHeader2 = $('<th><span class="table-sprites '+(MembershipController.currentSorting==='Restricted'?(MembershipController.currentSortingDir==='A'?"table-sortasc":"table-sortdesc"):"table-sortboth")+'"></span><span>&#128272;</span></th>').click(MembershipController.sortView.bind(this, 'Restricted'));
        var colHeader3 = $('<th><span class="table-sprites '+(MembershipController.currentSorting==='Created'?(MembershipController.currentSortingDir==='A'?"table-sortasc":"table-sortdesc"):"table-sortboth")+'"></span><span>Created</span></th>').click(MembershipController.sortView.bind(this, 'Created'));
        var colHeader4 = $('<th><span class="table-sprites '+(MembershipController.currentSorting==='Name'?(MembershipController.currentSortingDir==='A'?"table-sortasc":"table-sortdesc"):"table-sortboth")+'"></span><span>Name</span></th>').click(MembershipController.sortView.bind(this, 'Name'));
        var colHeader5 = $('<th><span class="table-sprites '+(MembershipController.currentSorting==='Members'?(MembershipController.currentSortingDir==='A'?"table-sortasc":"table-sortdesc"):"table-sortboth")+'"></span><span>Members</span></th>').click(MembershipController.sortView.bind(this, 'Members'));
        var colHeader6 = $('<th><span class="table-sprites '+(MembershipController.currentSorting==='Lives'?(MembershipController.currentSortingDir==='A'?"table-sortasc":"table-sortdesc"):"table-sortboth")+'"></span><span>Lives</span></th>').click(MembershipController.sortView.bind(this, 'Lives'));
        var colHeader7 = $('<th><span class="table-sprites '+(MembershipController.currentSorting==='Last Activity'?(MembershipController.currentSortingDir==='A'?"table-sortasc":"table-sortdesc"):"table-sortboth")+'"></span><span>Last Activity</span></th>').click(MembershipController.sortView.bind(this, 'Last Activity'));
        var colHeader8 = $('<th><span class="table-sprites '+(MembershipController.currentSorting==='Owner'?(MembershipController.currentSortingDir==='A'?"table-sortasc":"table-sortdesc"):"table-sortboth")+'"></span><span>Owner</span></th>').click(MembershipController.sortView.bind(this, 'Owner'));
        var colHeader9 = $('<th></th>');
        var groupMembershipTableHeaderRow = $('<tr></tr>>')
            .append(colHeader1)
            .append(colHeader2)
            .append(colHeader3)
            .append(colHeader4)
            .append(colHeader5)
            .append(colHeader6)
            .append(colHeader7)
            .append(colHeader8)
            .append(colHeader9);
        var groupMembershipTableHeader = $('<thead></thead>>').append(groupMembershipTableHeaderRow);
        var groupMembershipTable = $('<table id="GroupMembershipTable" class="blueTable"></table>')
            .append(groupMembershipTableHeader)
            .append($('<tbody></tbody>'));
        $('#GroupMembershipContainer').empty().append(groupMembershipTable);
    },

    addChannelToTableView: function (content, channel) {
        var channel_cid = $('<td class="channelCID"><a>' + channel.CID + '</a></td>').click(switchSection.bind(null, 'Channel', channel.CID));
        var channel_owner = $('<td class="channelOwner"><a>' + channel.OwnerId + '</a></td>').click(switchSection.bind(null, 'User', channel.OwnerId));
        var channel_buttons = $('<td class="text-right"></td>')
            .append($('<div class="btn-group"></div>'));
        channel_buttons.append($('<button type="submit" class="btn btn-secondary btn-sm"><i class="fas fa-running"></i><span class="d-none d-md-inline"> Leave</span></button>')
            .click(MembershipController.leaveChannel.bind(this, channel.CID, channel.Name)));
        if (!channel.RestrictMembersManagement || channel.OwnerId === loginTwitter.user.id) {
            channel_buttons.append($('<button type="submit" class="btn btn-primary btn-sm"><i class="fas fa-file-signature"></i><span class="d-none d-md-inline"> Rename</span></button>')
                .click(MembershipController.renameChannel.bind(this, channel.CID, channel.Name)));
            channel_buttons.append($('<button type="submit" class="btn btn-info btn-sm"><i class="fas fa-user-plus"></i><span class="d-none d-md-inline"> Add</span></button>')
                .click(MembershipController.addChannelMembers.bind(this, channel.CID, channel.Name)));
            if (channel.OwnerId === loginTwitter.user.id)
                channel_buttons.append($('<button type="submit" class="btn btn-danger btn-sm"><i class="fas fa-trash-alt" aria-hidden="true"></i><span class="d-none d-md-inline"> Delete</span></button>')
                    .click(MembershipController.deleteChannel.bind(this, channel.CID, channel.Name)));
        }
        var createdDate = new Date(channel.CreatedAt);
        var lastActivityDate = new Date(channel.LastActivity);
        var restricted = channel.RestrictMembersManagement ? '<td class="channelRestricted">&#128272;</td>' : '<td class="channelRestricted"></td>';

        content.append($('<tr id="CID'+channel.CID+'row">')
            .append(channel_cid)
            .append($(restricted))
            .append($('<td class="channelCreated">' + MembershipController.formatDate(createdDate) + '</td>'))
            .append($('<td class="channelName">' + emoji.replace_unified(channel.Name) + '</td>'))
            .append($('<td class="channelNMembers">' + (channel.NMember === 1000 ? '>=' : '' ) + channel.NMember + '</td>'))
            .append($('<td class="channelNLive">' + channel.NLive + '</td>'))
            .append($('<td class="channelLastActivity">' + MembershipController.formatDate(lastActivityDate) + '</td>'))
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

    sortView: function(col) {
        if (col === MembershipController.currentSorting ) {
            if (MembershipController.currentSortingDir === 'D')
                MembershipController.currentSortingDir = 'A';
            else
                MembershipController.currentSortingDir = 'D';
        }
        else {
            MembershipController.currentSorting = col;
            if (col === 'Name' || col === 'Owner')
                MembershipController.currentSortingDir = 'A';
            else
                MembershipController.currentSortingDir = 'D';
        }
        switch (MembershipController.currentSorting) {
            case 'CID':
                if (MembershipController.currentSortingDir === 'A')
                    MembershipController.channelsArray.sort(function (a, b) { return (a.CID > b.CID ? 1 : a.CID < b.CID ? -1 : 0); });
                else
                    MembershipController.channelsArray.sort(function (a, b) { return (a.CID > b.CID ? -1 : a.CID < b.CID ? 1 : 0); });
                break;
            case 'Restricted':
                if (MembershipController.currentSortingDir === 'A')
                    MembershipController.channelsArray.sort(function (a, b) { return (a.RestrictMembersManagement === b.RestrictMembersManagement ? 0 : 1); });
                else
                    MembershipController.channelsArray.sort(function (a, b) { return (a.RestrictMembersManagement === b.RestrictMembersManagement ? 0: -1); });
                break;
            case 'Created':
                if (MembershipController.currentSortingDir === 'A')
                    MembershipController.channelsArray.sort(function (a, b) { return (a.CreatedAt > b.CreatedAt ? 1 : a.CreatedAt < b.CreatedAt ? -1 : 0); });
                else
                    MembershipController.channelsArray.sort(function (a, b) { return (a.CreatedAt > b.CreatedAt ? -1 : a.CreatedAt < b.CreatedAt ? 1 : 0); });
                break;
            case 'Name':
                if (MembershipController.currentSortingDir === 'A')
                    MembershipController.channelsArray.sort(function (a, b) { return (a.Name > b.Name ? 1 : a.Name < b.Name ? -1 : 0); });
                else
                    MembershipController.channelsArray.sort(function (a, b) { return (a.Name > b.Name ? -1 : a.Name < b.Name ? 1 : 0); });
                break;
            case 'Members':
                if (MembershipController.currentSortingDir === 'A')
                    MembershipController.channelsArray.sort(function (a, b) { return a.NMember - b.NMember; });
                else
                    MembershipController.channelsArray.sort(function (a, b) { return b.NMember - a.NMember; });
                break;
            case 'Lives':
                if (MembershipController.currentSortingDir === 'A')
                    MembershipController.channelsArray.sort(function (a, b) { return a.NLive - b.NLive; });
                else
                    MembershipController.channelsArray.sort(function (a, b) { return b.NLive - a.NLive; });
                break;
            case 'Last Activity':
                if (MembershipController.currentSortingDir === 'A')
                    MembershipController.channelsArray.sort(function (a, b) { return (a.LastActivity > b.LastActivity ? 1 : a.LastActivity < b.LastActivity ? -1 : 0); });
                else
                    MembershipController.channelsArray.sort(function (a, b) { return (a.LastActivity > b.LastActivity ? -1 : a.LastActivity < b.LastActivity ? 1 : 0); });
                break;
            case 'Owner':
                if (MembershipController.currentSortingDir === 'A')
                    MembershipController.channelsArray.sort(function (a, b) { return (a.OwnerId > b.OwnerId ? 1 : a.OwnerId < b.OwnerId ? -1 : 0); });
                else
                    MembershipController.channelsArray.sort(function (a, b) { return (a.OwnerId > b.OwnerId ? -1 : a.OwnerId < b.OwnerId ? 1 : 0); });
                break;
        }
        MembershipController.displayData();
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
            MembershipController.setTitle();
        }, channels_url_root);
    },

    setTitleRetrieving: function() {
        $('#GroupMembershipTitle')[0].innerText = "Groups - retrieving the data...";
    },

    setTitle: function() {

        $('#GroupMembershipTitle')[0].innerText =  MembershipController.channelsArray.length + (MembershipController.moreChannels ? " and still more" : " total" ) +
            " groups sorted by " + MembershipController.currentSorting + (MembershipController.currentSortingDir==='A'?" ascending": " descending") ;
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
