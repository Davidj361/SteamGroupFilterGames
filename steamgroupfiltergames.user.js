// ==UserScript==
// @name Steam Group Filter Games
// @version 1
// @namespace steamgroupfiltergames
// @description Filter Steam group members by what game is being played
// @include https://steamcommunity.com/groups/*
// @include http://steamcommunity.com/groups/*
// @require https://steamcommunity-a.akamaihd.net/public/javascript/jquery-1.11.1.min.js
// @resource  loadingIcon http://www.nysut.org/_Images/_global/loading.gif
// @run-at document-end
// @grant  unsafeWindow
// @grant GM_getResourceURL
// ==/UserScript== 

// TODO upgrade JQuery

// A lot of shit was put in to deal with shitty AJAX that Steam is doing and which this script relies on 

// Have to hook Steam's shitty AJAX which screws the script up

var steamGroupFilterStarted = false;
var hookSteamAjax = function() {
    var old = unsafeWindow.OnGroupContentLoadComplete;
    unsafeWindow.OnGroupContentLoadComplete = function(strTab, url, transport) {
        alert("the happening");
        var ret = old(strTab, url, transport);
        steamGroupFilterStarted = false;
        steamGroupFilterGames();
        return ret;
    };
    steamGroupFilterGames();
}
var steamGroupFilterGames = function() {

    var main = function(jNode) {
        if (steamGroupFilterStarted)
            return;
        steamGroupFilterStarted = true;


        // Get the max page number
        var n = (function () {
            // We're already on the last page
            var $a = $('.pageLinks').contents().filter(function() {
                return this.nodeType === 3 && !$(this).parent('a').length && $(this).text().trim().length;
            })[1].data.trim();

            // We're not on the last page
            var url = $(".pagelink").last().attr("href");
            // Use some shitty regex to find the last page
            var reg = /\?p=([^"]+)/; // Filter for the page number
            var b = url.match(reg)[1]; // the number of pages for the group
        var result = 0;
        if ($a === undefined || isNaN($a))
            result = b;
        else
            result = Math.max($a, b);
        return result;
        })();

        var curr = 1; // Current page loaded
        var game = "";
        var groupUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        var nRetrieved = 0; // Number of users added and that passed the filter

        var startRetrieve = function() {
            // Show that we're retrieving
            var $loaderIcon = $("<img />", {
                id: 'loaderIcon',
                src: "" + GM_getResourceURL('loadingIcon')+ ""
            });
            $(".group_paging").first().append($loaderIcon);
            $(".group_paging").first().append("<div id='steamgroupfiltergamesPageCount'> Filtering Page " + curr + "/" + n + "</div>");
            retrieveDataFromNextPage();
        };

        // The function that is run when the filter is pressed
        var retrieveDataFromNextPage = function() {
            if (curr == n)
                return;

            var gets = []; // so we can have synchronousy

            // Hide the more button while we load the ajax
            $(".group_paging").last().hide(); // Hide the black bars

            // It will keep retrieving until it adds 51 users or reaches the end
            var pr = $.get(groupUrl + "/members/?p="+(curr++), {content_only: true})
                .then(function (data) {
                    // member block etc etc
                    $(".member_block", data).each(function(index) {
                        $(this).removeClass("last"); // CSS Fix
                        if ($(this).html().toLowerCase().search(game) != -1) {
                            var $elem = $(this);
                            $(".member_block_content", $elem).attr("style", "display: inline-block;"); // CSS Fix
                            // The GM_getResourceURL was being wonky
                            var $loaderIcon = $("<img />", {
                                id: 'loaderIcon',
                                src: "" + GM_getResourceURL('loadingIcon')+ ""
                            });
                            $elem.append($loaderIcon);
                            $("#memberList").append($elem);
                            nRetrieved++;
                            // Check if there's a join game button on the person's profile
                            var $profileUrl = $(".linkFriend", $(this)).attr("href");
                            $.get($profileUrl).then( function(d) {
                                $button = $(".btn_green_white_innerfade", d).last();
                                if ( ($button.attr("href") != undefined) && ($button.attr("href").search("joinlobby") != -1) ) {
                                    $button.attr("style", "float: right;"); // CSS Fix
                                    $elem.append($button);
                                }
                                $("#loaderIcon", $elem).remove();
                            });
                        }
                    });
                });
            gets.push(pr);

            // So we wait for all gets to be done with
            $.when.apply($, gets).then(function() {
                if(curr != n && nRetrieved < 51) {
                    $("#steamgroupfiltergamesPageCount").text("Filtering Page " + curr + "/" + n);
                    retrieveDataFromNextPage();
                } else {
                    $(".group_paging").first().empty();
                    $(".group_paging").last().show();
                    $("#memberList").append("<div id='steamgroupfiltergamesSpacer' style='clear: left;'></div><div style='clear: left;'></div>"); // Spacers due to horrible CSS
                    if (curr == n) {
                        $(".group_paging").empty();
                        $(".group_paging").last().append("<div>Reached End</div>");
                    } else if (nRetrieved >= 51) {
                        nRetrieved = 0; // Reset the count
                    }
                }
            });
        }

        // Populate this page with all players from the steamgroup playing this game right now via AJAX
        // retrieve all the html for all pages in the group
        var filter = function() {
            game = $("#filterGameKey").val().toLowerCase();
            curr = 1;
            nRetrieved = 0;

            // Clear up old data
            $("#memberList").empty();
            $(".group_paging").empty();
            $("#steamgroupfiltergamesSpacer").remove();
            // $("#memberList").append("<div id='steamgroupfiltergamesSpacer' style='clear: left;'></div><div style='clear: left;'></div>"); // Spacers due to horrible CSS

            // Create a more button that adds more players from each page when you click
            // It disappears after it reaches the max page
            var $moreButton = $("<div/>", {
                id: "filterMoreButton",
                style: "text-align: center;",
                class: "btn_green_white_innerfade btn_small_thin",
                click: function() {
                    startRetrieve();
                    if (curr == n) {
                        $(".group_paging").empty();
                        $(".group_paging").last().text("Reached End");
                    }
                }
            });
            $(".group_paging").last().append($moreButton);
            $("#filterMoreButton").append("<span>\\|/ Add Next 50 Users \\|/</span>");
            $(".group_paging").css("text-align", "center"); // CSS Fix
            $(".group_paging").css("height", "auto"); // CSS Fix

            startRetrieve();
        }

        // Create our html for the filterbar and submit button
        // Pretty much copy pasted the steam's for searching users
        var $filterbar = $('\
                <form class="smallForm" id="steamgroupfiltergames" name="steamgroupfiltergames"> \
                <div class="gray_bevel for_text_input"> \
                <input size="70" class="" name="filterGameKey" id="filterGameKey" placeholder="Enter a game to filter..." value=""> \
                </div> \
                <button type="submit" class="btn_green_white_innerfade btn_medium"> \
                <span>Filter</span> \
                </button> \
                <div id="filterGameAreaClear"> \
                <div style="clear: left;"></div> \
                </div> \
                </form>');

        // Add a filter bar to filter the steam group for a game
        $(".search_controls").append($filterbar);
        // You need preventDefault so when you submit the page doesn't change and the form doesn't do a POST/GET
        $("#steamgroupfiltergames").bind('submit', function(evt) {evt.preventDefault(); filter(); });
    }
    // // /*--- waitForKeyElements():  A utility function, for Greasemonkey scripts,
    //     that detects and handles AJAXed content.
    // 
    //     Usage example:
    // 
    //         waitForKeyElements (
    //             "div.comments"
    //             , commentCallbackFunction
    //         );
    // 
    //         //--- Page-specific function to do what we want when the node is found.
    //         function commentCallbackFunction (jNode) {
    //             jNode.text ("This comment changed by waitForKeyElements().");
    //         }
    // 
    //     IMPORTANT: This function requires your script to have loaded jQuery.
    // */
    function waitForKeyElements (
            selectorTxt,    /* Required: The jQuery selector string that
                               specifies the desired element(s).
                               */
            actionFunction, /* Required: The code to run when elements are
                               found. It is passed a jNode to the matched
                               element.
                               */
            bWaitOnce,      /* Optional: If false, will continue to scan for
                               new elements even after the first match is
                               found.
                               */
            iframeSelector  /* Optional: If set, identifies the iframe to
                               search.
                               */
            ) {
                var targetNodes, btargetsFound;

                if (typeof iframeSelector == "undefined")
                    targetNodes     = $(selectorTxt);
                else
                    targetNodes     = $(iframeSelector).contents ()
                        .find (selectorTxt);

                if (targetNodes  &&  targetNodes.length > 0) {
                    btargetsFound   = true;
                    /*--- Found target node(s).  Go through each and act if they
                      are new.
                      */
                    targetNodes.each ( function () {
                        var jThis        = $(this);
                        var alreadyFound = jThis.data ('alreadyFound')  ||  false;

                        if (!alreadyFound) {
                            //--- Call the payload function.
                            var cancelFound     = actionFunction (jThis);
                            if (cancelFound)
                        btargetsFound   = false;
                            else
                        jThis.data ('alreadyFound', true);
                        }
                    } );
                }
                else {
                    btargetsFound   = false;
                }

                //--- Get the timer-control variable for this selector.
                var controlObj      = waitForKeyElements.controlObj  ||  {};
                var controlKey      = selectorTxt.replace (/[^\w]/g, "_");
                var timeControl     = controlObj [controlKey];

                //--- Now set or clear the timer as appropriate.
                if (btargetsFound  &&  bWaitOnce  &&  timeControl) {
                    //--- The only condition where we need to clear the timer.
                    clearInterval (timeControl);
                    delete controlObj [controlKey]
                }
                else {
                    //--- Set a timer, if needed.
                    if ( ! timeControl) {
                        timeControl = setInterval ( function () {
                            waitForKeyElements (    selectorTxt,
                                actionFunction,
                                bWaitOnce,
                                iframeSelector
                                );
                        },
                        300
                        );
                        controlObj [controlKey] = timeControl;
                    }
                }
                waitForKeyElements.controlObj   = controlObj;
            }

    waitForKeyElements(".pagelink", main, true);

}

// window.addEventListener ("load", hookSteamAjax, false);

var check = function () {
    console.log("yep");
    if (typeof unsafeWindow.OnGroupContentLoadComplete === "function") {
        var old = unsafeWindow.OnGroupContentLoadComplete;
        unsafeWindow.OnGroupContentLoadComplete = function(strTab, url, transport) {
            alert("the happening");
            // var ret = old(strTab, url, transport);
            // return ret;
        };
        return false;
    }
    setTimeout(check, 100);
};
check();
