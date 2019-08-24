var ChannelController = {
    caller_callback: null,
    init: function(parent, callback) {
        this.caller_callback = callback;
        var resultChannel = $('<div id="resultChannel" />');
        var showButton = $('<a class="button" id="showchannel">OK</a>').click(function () {
            resultChannel.empty();
            var cid = $('#channel_id').val().trim();
            if (cid)
                PeriscopeWrapper.V1_GET_ApiChannels(function (response) {
                    cid = response.Channel.CID;
                    $('#channel_id').val(cid);
                    //resultChannel.prepend(getChannelDescription(response.Channel));
                    resultChannel.prepend(response.Channel.Name);
                    if (response.Channel.NMember === 1000)
                        MembersSpoiler.append(' (' + response.Channel.NMember + ' or more)');
                    else
                        MembersSpoiler.append(' (' + response.Channel.NMember + ')');
                    ActionsSpoiler.append(' ( history )');
                    PeriscopeWrapper.V1_GET_ApiChannels(function (channelBroadcasts) {
                        this.createBroadcastsList($('#channelBroadcasts'), null)(channelBroadcasts);
                        BroadcastsSpoiler.append(' (' + channelBroadcasts.NLive +'/'+ channelBroadcasts.NReplay + ')').click();
              }, 'https://channels.pscp.tv/v1/channels/' + cid +'/broadcasts');
          }, 'https://channels.pscp.tv/v1/channels/' + cid);
          var BroadcastsSpoiler = $('<div class="spoiler menu" data-spoiler-link="broadcasts">Broadcasts</div>');
          var MembersSpoiler = $('<div class="spoiler menu" data-spoiler-link="members">Members</div>').on("jq-spoiler-visible", function () {
              var membersDiv = $('#channelMembers');
              if (!membersDiv.html())
                  PeriscopeWrapper.V1_GET_ApiChannels(function (response) {
                      if (response.Members.length) {
                          MembersSpoiler.append(' (' + response.Members.length + ')');
                          if (response.HasMore)
                              MembersSpoiler.append(' and more to get...');
                          for (var i in response.Members)
                              membersDiv.append($('<div class="card"/>').append(getMemberDescription(response.Members[i])));
                      } else
                          membersDiv.html('No results');
                  }, 'https://channels.pscp.tv/v1/channels/' + cid + '/members' );
          });
          var ActionsSpoiler = $('<div class="spoiler menu" data-spoiler-link="actions">History</div>').on("jq-spoiler-visible", function () {
              var actionsDiv = $('#channelActions');
              if (!actionsDiv.html())
                  PeriscopeWrapper.V1_GET_ApiChannels(function (response) {
                      if (response.Actions.length) {
                          ActionsSpoiler.append(' (' + response.Actions.length + ')');
                          if (response.HasMore)
                              ActionsSpoiler.append(' and more to get...');
                          for (var i in esponse.Actions)
                              actionsDiv.append($('<div class="card"/>').append(getActionDescription(esponse.Actions[i])));
                      } else
                          actionsDiv.html('No results');
                  },'https://channels.pscp.tv/v1/channels/' + cid + '/actions' );
          });
          resultChannel.append(BroadcastsSpoiler, '<div class="spoiler-content" data-spoiler-link="broadcasts" id="channelBroadcasts" />',
              MembersSpoiler, '<div class="spoiler-content" data-spoiler-link="members" id="channelMembers" />',
              ActionsSpoiler, '<div class="spoiler-content" data-spoiler-link="actions" id="channelActions" />');
          $(".spoiler").spoiler({triggerEvents: true});
        });
        var idInput = $('<div id="Channel">CID: <input id="channel_id" type="text" size="20" placeholder="channel_id"></div>');
        $('#right').append(idInput.append(showButton, '<br/><br/>', resultChannel));
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
        load_channel: function(channels, loginTwitter) {
            defer = $.Deferred();
            channels.empty();
        var channels_url_root = 'https://channels.pscp.tv/v1/users/' + loginTwitter.user.id + '/channels';
        PeriscopeWrapper.V1_GET_ApiChannels(function (response) {
            if (!response.Channels)
            {
                defer.resolve();
                return defer;
            }
            for (var i in response.Channels) {
                channel_description = GroupsController.add_channel(channels, response.Channels[i]);
                var channel_members_url = "https://channels.pscp.tv/v1/channels/" + response.Channels[i].CID + "/members/" + loginTwitter.user.id;
                var owner_id =  response.Channels[i].OwnerId;
                channel_description
                    .append("<br/>Members: ")
                    .append($('<a>' + response.Channels[i].NMember + '</a>').click(function () { window.alert("Not yet implemented"); }))
                    .append("<br/>Owner: ")
                    .append($('<a>' + owner_id + '</a>').click(switchSection.bind(null, 'User', owner_id)))
                    .append("<br/>")
                    .append($('<a class="button">leave</a>').click(function () {
                        if (confirm('Are you sure you want to leave the group "'+response.Channels[i].Name+'"?')) {
                            PeriscopeWrapper.V1_ApiChannels(
                                function (response) {
                                    GroupsController.load_groups_data(GroupsController.caller_callback);
                                },
                                channel_members_url,
                                null,
                                null,
                                "DELETE");
                        }
                    } ));
            }
            $('#GroupMembershipTitle')[0].innerText = response.Channels.length + " Group Memberships";
            defer.resolve();
        }, channels_url_root);
        return defer;
    },
    load_channel_data: function(callback) {
        loginTwitter = localStorage.getItem('loginTwitter');
        loginTwitter = JSON.parse(loginTwitter);

        this.load_channel($('#resultChannel'), loginTwitter)
            .done(function () {
                this.load_channel_broadcasts($('#ChannelBroadcasts'), loginTwitter)
                    .done(function () {
                        if (callback)
                            callback();
                    });
            });
    }
};
