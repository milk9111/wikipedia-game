
$('.toast').toast({
    'autohide': false
});

let gameProps = {
    start: "",
    target: "",
    clicks: 0,
    isRedirectPage: false,
    history: [],
    isHistoryShowing: false
};

function searchArticle(search, callbackFn) {
    if (search === "" || search === null || search === undefined) {
        setFailureToast("Cannot be empty.");
        showToast();
        return;
    }

    let topic = encodeURIComponent(search);

    showElement("#loadingSpinnerSearch");

    let failedApiCall = false;

    $.ajax(
        {
            url: "https://en.wikipedia.org/w/api.php?origin=*&action=query&format=json&list=prefixsearch&pssearch=" + topic, 
            success: function(result, status, xhr){
                if (xhr.status !== 200 || result === null || result.query === null || result.query.prefixsearch === null || result.query.prefixsearch.length === 0 || !topicExists(search, result.query.prefixsearch)) {
                    setFailureToast("Could not find an article for the given topic.");
                    failedApiCall = true;
                } else {
                    setSuccessToast("That topic exists!");
                }

                showToast();
            }
        }
    ).done(function(msg) {
        hideElement("#loadingSpinnerSearch");
        if (!failedApiCall && callbackFn !== null && callbackFn !== undefined) {
            callbackFn();
        }
    });
}

function startGame(start, target) {
    if (start === target) {
        setFailureToast("Cannot have same start and target.");
        showToast();
        return;
    }

    searchArticle(start, function() {
        searchArticle(target, function() {
            gameProps.start = start;
            gameProps.target = target;
            gameProps.clicks = 0;
            gameProps.history = [];

            $("#historyList").empty();
            $("#clickCounter").text(gameProps.clicks);

            setGameBoard(start);
        })
    });
}

function setGameBoard(topic) {
    hideElement("#content");
    showElement("#gameBounds");

    showElement("#loadingSpinner");

    $.ajax({
        method: "GET",
        url: "https://en.wikipedia.org/w/api.php?origin=*&action=parse&format=json&prop=text&formatversion=2&page=" + encodeTopic(topic),
        success: function(result, status, xhr) {
            if (xhr.status !== 200 || result === null || result.parse === null || result.parse.text === null || result.parse.text === "") {
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

        let hasWon = false;

        if (encodeTopic(topic).toLowerCase() === encodeTopic(gameProps.target).toLowerCase()) {
            alert("You won the game in " + gameProps.clicks + " clicks!");
            hasWon = true;
        }

        $("a").on("click", function(event){
            let href = $(this).attr("href");
            let urlPrefix = href.substring(0, 6);
            if (urlPrefix === "/wiki/") {
                event.preventDefault();

                if (hasWon) {
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
            }
        });
    });
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

    $("#historyList").append("<li>" + gameProps.history[gameProps.history.length - 1] + "</li>");
}

function setSuccessToast(message) {
    $("#searchToast").css("background-color", "green");
    $("#searchToastHeader").text("Success");
    $("#searchToastBody").text(message);
}

function setFailureToast(message) {
    $("#searchToast").css("background-color", "red");
    $("#searchToastHeader").text("Failure");
    $("#searchToastBody").text(message);
}

function showToast() {
    $('#searchToast').toast('show');
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