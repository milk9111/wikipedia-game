
$('.toast').toast({
    'autohide': false
});

jQuery(function() {
    $('[data-toggle="tooltip"]').tooltip();

    let startTopic = getQueryParameterByName("start");
    let targetTopic = getQueryParameterByName("target");

    if (isNullOrEmpty(startTopic) || isNullOrEmpty(targetTopic)) {
        return;
    }

    // it should be assumed that if the start and target are given then they have already been validated so just hide the fields
    // for style purposes.
    hideElement("#searchForm");
    hideElement("#submitForm");

    startGame(startTopic, targetTopic);
});

let gameProps = {
    start: "",
    target: "",
    clicks: 0,
    isRedirectPage: false,
    history: [],
    isHistoryShowing: false,
    hasWon: false,
    url: window.location.href,
    baseUrl: getBaseUrl(),
    queryParams: "",
    modal: {
        contentId: "modalContent_default"
    }
};

function getBaseUrl() {
    let queryParamsStartPos = window.location.href.indexOf("?");
    if (queryParamsStartPos === -1) {
        return window.location.href;
    }

    return window.location.href.substring(0, queryParamsStartPos);
}

function copyToClipboard() {
    showElement("#hiddenUrl");
    var copyText = document.getElementById("hiddenUrl");

    copyText.value = gameProps.url;

    copyText.select();
    copyText.setSelectionRange(0, 99999); 

    document.execCommand("copy");
    $("#clipboardTooltip").attr("data-original-title", "Copied!");

    $('[data-toggle="tooltip"]').tooltip('hide')
      .tooltip('show');

    hideElement("#hiddenUrl");
    showElement("#copied");
}

function searchArticle(config) {
    hideElement("#topicSearchDropdown");

    if (isNullOrEmpty(config.search)) {
        setFailureToast("Cannot be empty.");
        showToast();
        return;
    }

    let topic = encodeURIComponent(config.search);

    showElement("#loadingSpinnerSearch");

    let failedApiCall = false;

    $.ajax(
        {
            url: "https://en.wikipedia.org/w/api.php?origin=*&action=query&format=json&list=prefixsearch&pssearch=" + topic, 
            success: function(result, status, xhr){
                if (xhr.status !== 200 || result === null || result.query === null || result.query.prefixsearch === null || result.query.prefixsearch.length === 0 || !topicExists(config.search, result.query.prefixsearch)) {
                    setFailureToast("Could not find an article for the given topic.");
                    failedApiCall = true;
                } else {
                    setSuccessToast("That topic exists!");
                }

                if (!isNullOrEmpty(config.topicInputId)) {
                    clearTopicStatus(config.topicInputId);

                    $(config.topicInputId).addClass(failedApiCall ? "badTopic" : "goodTopic");
                }

                showToast();
            }
        }
    ).done(function(msg) {
        hideElement("#loadingSpinnerSearch");
        if (!failedApiCall && config.callbackFn !== null && config.callbackFn !== undefined) {
            config.callbackFn();
        }
    });
}

function populateSearchDropdown() {
    let searchTopic = $('#searchTopic').val().trim();

    let url = "https://en.wikipedia.org/wiki/" + encodeTopic(searchTopic);

    showElement("#topicSearchDropdown");
    $("#topicSearchDropdown").html("<a target=\"_blank\" style=\"color: blue; text-decoration: underline;\" class=\"dropdown-item\" href=\"" + url + "\">" + url + "</a>");
}

function lookupSearchTopic(topic) {
    if (isNullOrEmpty(topic)) {
        $("#searchTopic").addClass("badTopic");
        setFailureToast("Search field is empty");
        showToast();
        return;
    }

    searchArticle({ search: topic, callbackFn: populateSearchDropdown, topicInputId: "#searchTopic" });
}

function startGame(start, target) {
    let hasFailed = false;
    if (isNullOrEmpty(start)) {
        hasFailed = true;
        $("#startTopic").addClass("badTopic");
    }

    if (isNullOrEmpty(target)) {
        hasFailed = true;
        $("#targetTopic").addClass("badTopic");
    }

    if (hasFailed) {
        setFailureToast("Cannot have empty fields");
        showToast();
        return;
    }

    if (start === target) {
        $("#startTopic").addClass("badTopic");
        $("#targetTopic").addClass("badTopic");
        setFailureToast("Cannot have same start and target.");
        showToast();
        return;
    }

    searchArticle({ search: start, topicInputId: "#startTopic", callbackFn: function() {
        searchArticle({ search: target, topicInputId: "#targetTopic", callbackFn: function() {
            gameProps.start = start;
            gameProps.target = target;
            gameProps.clicks = 0;
            gameProps.history = [];
            gameProps.isHistoryShowing = false;
            gameProps.hasWon = false;
            gameProps.queryParams = "";

            if (gameProps.url === gameProps.baseUrl) {
                gameProps.queryParams = "?start=" + encodeURIComponent(start) + "&target=" + encodeURIComponent(target);
                gameProps.url = gameProps.baseUrl + gameProps.queryParams;
            }

            $("#hiddenUrl").val(gameProps.url);

            history.pushState("", "", gameProps.queryParams);

            $("#historyList").empty();
            $("#clickCounter").text(gameProps.clicks);

            hideElement("#searchForm");
            hideElement("#submitForm");

            showElement("#newGameSection");
            showElement("#newGameButton");
            showElement("#gameStats");

            setGameBoard(start);
        }})
    }});
}

function setGameBoard(topic) {
    hideElement("#content");
    showElement("#gameBounds");

    showElement("#loadingSpinner");

    $.ajax({
        method: "GET",
        url: "https://en.wikipedia.org/w/api.php?origin=*&action=parse&format=json&prop=text&formatversion=2&page=" + encodeTopic(topic),
        success: function(result, status, xhr) {
            if (xhr.status !== 200 || result === null || result.parse === null || isNullOrEmpty(result.parse.text)) {
                alert("Invalid start topic");
                return;
            }

            gameProps.isRedirectPage = result.parse.text.includes("redirectMsg");
            gameProps.isRedirectPage ? showElement("#redirectMessage") : hideElement("#redirectMessage");

            showElement("#content");
            $("#firstHeading").text(result.parse.title);

            if (!gameProps.isRedirectPage) {
                gameProps.history.push(result.parse.title);
                updateHistoryList();
            }

            $("#mw-content-text").empty();
            $("#mw-content-text").append(result.parse.text);
        }
    }).done(function(msg){
        hideElement("#loadingSpinner");

        gameProps.hasWon = false;

        if (encodeTopic(topic).toLowerCase() === encodeTopic(gameProps.target).toLowerCase()) {
            gameProps.hasWon = true;
            alert("You won the game in " + gameProps.clicks + " clicks!");
        }

        $("a").on("click", function(event){
            let href = $(this).attr("href");
            let urlPrefix = href.substring(0, 6);
            if (urlPrefix === "/wiki/") {
                event.preventDefault();

                if (gameProps.hasWon) {
                    return; 
                }

                if (!gameProps.isRedirectPage) {
                    gameProps.clicks++;
                }
                
                $("#clickCounter").text(gameProps.clicks);

                setGameBoard(href.substring(6));
            } else if (urlPrefix[0] !== '#' && urlPrefix[0] !== '/') {
                event.preventDefault();
                alert("External links aren't allowed!");
            } else if (urlPrefix[0] === '#') {
                event.preventDefault();
                $('html, body').animate({
                    scrollTop: $(href).offset().top
                }, 10);
            }
        });
    });
}

function confirmNewGame() {
    // if the player has won and they select a new game then don't bother with the modal
    if (gameProps.hasWon) {
        newGame();
        return;
    }

    setModal({
        contentId: "modalContent_newGame",
        buttons: [
            {
                id: "modalContent_newGame_yes",
                callbackFn: newGame 
            },
            {
                id: "modalContent_newGame_cancel",
                callbackFn: closeModal 
            }
        ]
    });

    showModal();
}

function newGame() {
    gameProps.start = "";
    gameProps.target = "";
    gameProps.clicks = 0;
    gameProps.history = [];
    gameProps.isHistoryShowing = false;
    gameProps.hasWon = false;
    gameProps.url = gameProps.baseUrl;
    window.history.pushState("", "", gameProps.url);
    toggleHistory();

    clearTopicStatus("#searchTopic");
    clearTopicStatus("#startTopic");
    clearTopicStatus("#targetTopic");

    $("#startTopic").val("");
    $("#targetTopic").val("");
    $("#searchTopic").val("");

    showElement("#searchForm");
    showElement("#submitForm");

    hideElement("#content");
    hideElement("#newGameButton");
    hideElement("#newGameSection");
    hideElement("#copied");
    hideElement("#gameStats");
    hideElement("#redirectMessage");

    closeModal();

    $("#historyList").empty();
    $("#clickCounter").text(gameProps.clicks);
}

function toggleHistory() {
    gameProps.isHistoryShowing = !gameProps.isHistoryShowing;
    gameProps.isHistoryShowing ? showElement("#historyList") : hideElement("#historyList");

    $("#historyListToggle").removeClass("bi-chevron-down");
    $("#historyListToggle").removeClass("bi-chevron-up");

    $("#historyListToggle").addClass(gameProps.isHistoryShowing ? "bi-chevron-up" : "bi-chevron-down");
}

function updateHistoryList() {
    if (gameProps.history.length === 0) {
        return;
    }

    let startTopicSignifier = gameProps.history.length === 1 ? " - <b> Start Topic </b>" : "";

    $("#historyList").append("<li>" + gameProps.history[gameProps.history.length - 1] + startTopicSignifier + "</li>");
}

function setSuccessToast(message) {
    $("#searchToast").css("background-color", "#99ff99");
    $("#searchToastHeader").text("Success");
    $("#searchToastBody").text(message);
}

function setFailureToast(message) {
    $("#searchToast").css("background-color", "#ff9999");
    $("#searchToastHeader").text("Failure");
    $("#searchToastBody").text(message);
}

function showToast() {
    $('#searchToast').toast('show');
}

function supports_history_api() {
    return !!(window.history && history.pushState);
  }

function hideElement(el) {
    $(el).addClass("d-none");
}

function showElement(el) {
    $(el).removeClass("d-none");
}

function encodeTopic(topic) {
    return topic.replace(" ", "_");
}

function topicExists(topic, searchResults) {
    let found = false;

    searchResults.forEach(function(item, index) {
        if (found) {
            return;
        }

        found = item.title.toLowerCase() === topic.toLowerCase();
    });

    return found;
}

function clearTopicStatus(topicInputId) {
    $(topicInputId).removeClass("goodTopic");
    $(topicInputId).removeClass("badTopic");
}

function setModal(settings) {
    hideElement("#" + gameProps.modal.contentId);

    let content = $("#" + settings.contentId);
    if (content === null || content === undefined) {
        settings.contentId = "modalContent_default";
        content = $("#" + settings.contentId);
    }

    gameProps.modal.contentId = settings.contentId;
    
    if (settings.buttons !== null) {
        $.each(settings.buttons, function(index, value) {
            $("#" + value.id).on("click", value.callbackFn);
        });
    }

    showElement("#" + gameProps.modal.contentId);
}

function showModal() {
    $("#myModal").css("display", "block");
}

function closeModal() {
    $("#myModal").css("display", "none");
}

function getQueryParameterByName(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

function isNullOrEmpty(string) {
    return string === null || string === undefined || string === "";
}