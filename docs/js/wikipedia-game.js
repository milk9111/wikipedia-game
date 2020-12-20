
$('.toast').toast({
    'autohide': false
});

let gameProps = {
};

function searchArticle(search) {
    if (search === "" || search === null || search === undefined) {
        return;
    }

    let topic = encodeURIComponent(search);

    $("#loadingSpinnerSearch").removeClass("d-none");

    $.ajax(
        {
            url: "https://en.wikipedia.org/w/api.php?origin=*&action=query&format=json&list=prefixsearch&pssearch=" + topic, 
            success: function(result, status, xhr){
                if (xhr.status !== 200 || result === null || result.query === null || result.query.prefixsearch === null || result.query.prefixsearch.length === 0 || !topicExists(search, result.query.prefixsearch)) {
                    $("#searchToast").css("background-color", "red");
                    $("#searchToastHeader").text("Failure");
                    $("#searchToastBody").text("Could not find an article for the given topic.");
                } else {
                    $("#searchToast").css("background-color", "green");
                    $("#searchToastHeader").text("Success");
                    $("#searchToastBody").text("That topic exists!");
                }

                $('#searchToast').toast('show');
            }
        }
    ).done(function(msg) {
        $("#loadingSpinnerSearch").addClass("d-none");
    });
}

function startGame(start, target) {
    // TODO - Validate that start topic exists and show error if not

    // TODO - Validate that target topic exists and show error if not

    setGameBoard(start);
}

function setGameBoard(topic) {
    $("#gameContent").addClass("d-none");
    $("#gameBounds").removeClass("d-none");

    $("#loadingSpinner").removeClass("d-none");

    $.ajax({
        method: "GET",
        url: "https://en.wikipedia.org/w/api.php?origin=*&action=parse&format=json&prop=text&formatversion=2&page=" + encodeTopic(topic),
        success: function(result, status, xhr) {
            if (xhr.status !== 200 || result === null || result.parse === null || result.parse.text === null || result.parse.text === "") {
                alert("Invalid start topic");
                return;
            }

            $("#gameContent").removeClass("d-none");
            $("#gameContent").empty();
            $("#gameContent").append(result.parse.text);
        }
    }).done(function(msg){
        $("#loadingSpinner").addClass("d-none");

        $("a").on("click", function(event){
            var href = $(this).attr("href");
            if (href.substring(0, 6) === "/wiki/") {
                event.preventDefault();
                setGameBoard(href.substring(6));
            }
        });
    });
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