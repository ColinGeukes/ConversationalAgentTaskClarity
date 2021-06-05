let Chatbot = function (taketurn, show_message) {

    this.taketurn = taketurn;
    this.show_message = show_message;

    this.typing_rate = 10; // ms per character
    this.turn_taking = 100; // between-turn pause (ms)

    this.message_queue = [];
    this.utterance = 0;

    this.history = [];

    this.talk = function (text) {
        this.message_queue = text;
        this.utterance += 1;    // turn to a new utterance, ongoing utterance will be stopped
        this.utter(this.utterance, Date.now());
    };

    this.utter = function (utterance, start_time, i = 0) {
        let that = this;
        if (utterance !== that.utterance) {
            that.onmessage("chatbot", {start_time: start_time, text: "__interruption__"});
            return;  // turn to a new utterance
        }
        if (that.message_queue === undefined || i >= that.message_queue.length) return;
        let text = that.message_queue[i];

        // The code for the buttons.
        if (text.buttons) {
            that.show_message(text);
            that.utter(utterance, start_time, i + 1);
            return;
        }

        // The code for the message.
        option = text.msg;
        setTimeout(function () {
            that.show_message("loading");
            setTimeout(function () {
                if (utterance != that.utterance) {
                    that.onmessage("chatbot", {start_time: start_time, text: "__interruption__"});
                    return;  // turn to a new utterance
                }
                that.onmessage("chatbot", {start_time: start_time, text: option});
                that.utter(utterance, start_time, i + 1);
            }, option.length * that.typing_rate > 1000 ? 1000 : option.length * that.typing_rate);
        }, this.turn_taking);
    };

    this.send = function (message) { // message here also includes other information like type times and pauses
        this.onmessage("user", message);
        this.taketurn(this, message["text"]);
    };

    this.onmessage = function (person, message) {
        if (person === "chatbot") {
            this.history.push({
                person: "chatbot",
                start_time: message["start_time"],
                send_time: Date.now(),
                text: message["text"].split("<div")[0]
            });
            if (message["text"] !== "__interruption__") this.show_message("Chatbot:" + message["text"]);
        } else if (person === "user") {
            this.history.push({
                person: "user",
                start_time: message["start_time"],
                send_time: Date.now(), text: message,
                pauses: message["pauses"],
                keys: message["keys"],
                text: message["text"]
            });
            this.show_message("__you__:" + message["text"]);
        }
    }
};

let task_completed = false;

let start_time = 0;
let last_time = 0;
let pauses = [];
let keys = [];

let chatbot = new Chatbot(taketurn = function (chatbot, message) {
    // this function is used for processing users message and then decide how chatbot should reply.
    // you should use function chatbot.talk(["text1","text2"]) to reply.
    if (task_completed) {
        chatbot.talk(["😀"]);
        return;
    }

    const survey_validated = survey_validate(message);

    if (survey_validated !== null) {
        survey_validated();
    } else {
        // Repeat question maybe, but workers are not free to type, only allowed to
        // select buttons so it should not be an issue for our task.
    }
}, show_message = function (message) {
    bubble(message);
});

let current_question = null;
let survey_validate = function (input) {
    // The strip function.
    let strip = function (text) {
        return text.toLowerCase().replace(/[\s.,\/#!$%\^&\*;:{}=\-_'"`~()]/g, "");
    };
    const strippedInput = strip(input);

    // There should be a question available and an answer should contain text.
    if (strippedInput.length < 1 && current_question !== null) return null;

    // Retrieve the function that should be called based on the answer.
    let retFunc = false;
    current_question.buttons.forEach(e => {
        if (strip(e.button) === strippedInput) {
            // Store the flow of the selected button.
            recordUserFlow(strippedInput);

            retFunc = e.func;
        }
    });

    return retFunc;
};


var send = function (text) {
    var utterance = {
        start_time: start_time,
        pauses: pauses,
        keys: keys,
        text: text
    };
    chatbot.send(utterance);
    // clean the statistical data
    start_time = 0;
    last_time = 0;
    pauses = [];
    keys = [];
}

var loading_cell = document.createElement("div");

var loading = function () {              // show loading animation
    if (loading_cell.parentElement != undefined) loading_cell.parentElement.style = "display:none";
    var row = document.getElementById("chat-history").insertRow();
    loading_cell = row.insertCell();
    loading_cell.innerHTML = "<div class=\"lds-ellipsis\"><div></div><div></div><div></div><div></div></div>";
    to_bottom();
}

var buttons_cell = document.createElement("div");


// Method to show buttons.
var buttons = function (message) {
    current_question = message;
    if (buttons_cell.parentElement !== undefined && buttons_cell.parentElement !== null) {
        buttons_cell.parentElement.style = "display:none";
    }

    let row = document.getElementById("chat-history").insertRow();
    buttons_cell = row.insertCell();
    let str = "<div style=\"width:100%;text-align:center;\">";

    let btns = message.buttons;
    btns.forEach(function (e, i) {
        let param = encodeURIComponent(e.button).replace(/'/g, "%27");
        if (e.button.length > 0) str += "<div class=\"button\" onclick=\"select_button(\'" + param + "\')\">" + e.button + "</div>";  // show message, remove comment
    });
    buttons_cell.innerHTML = str + "</div>";

    to_bottom();
};

let bubble = function (message) {
    // if the message is "loading", show loading animation
    // if the message starts with "buttons", show buttons
    // if the message does not include ":", show the message as a notification
    // if the message includes ":", then it as a conversation bubble, the substring before ":" is the username
    if (message === undefined) return;
    if (message === "loading") {
        loading();
        return;
    }
    if (message.buttons) {
        buttons(message);
        return;
    }

    if (loading_cell.parentElement !== undefined) loading_cell.parentElement.style = "display:none";
    let row = document.getElementById("chat-history").insertRow();
    let cell = row.insertCell();
    cell.innerHTML = bubble_content(message);
    to_bottom();
};

let bubble_content = function (message) {
    let i = message.indexOf(":");
    if (i < 0)
        return "<div class=\"notification\"><p>" + message + "</p></div>";
    let t = new Date();
    let username = message.substring(0, i);
    let result = "";
    if (username !== "__you__") {
        if (!(typeof chatbot_name === 'undefined')) username = chatbot_name;
        result = "<span style=\"font-size:10px;color:#999999;\">" + username + "  ";  // show username
    } else {
        // result = "<span style=\"font-size:10px;color:#d9d9d9;\">"
        result = "<span style=\"font-size:10px;color:#208000;\">"
    }
    result += ("0" + t.getHours()).slice(-2) + ":" + ("0" + t.getMinutes()).slice(-2) + "</span><br/>"; // show time hh:mm

    let message_content = message.substring(i + 1, message.length);
    if (message_content.indexOf("RAW:") === 0) {
        result += message_content.replace("RAW:", ""); // raw message, keep comment
    } else {
        result += message_content.split('%%')[0]; // show message, remove comment
    }
    if (username === "__you__")
        result = "<div class=\"right-arrow\"></div><div class=\"bubble-me\">" + result + "</div>";  // user's bubble
    else
        result = "<div class=\"left-arrow\"></div><div class=\"bubble\">" + result + "</div>";      // other's bubble
    return result;
};


let click_send = function () {
    let m = document.getElementById("message");
    if (m.value === "") return;
    if (m.value.length > 5000) {
        alert("Your message is too long!");
        return;
    }
    count();
    send(m.value);
    m.value = "";
    if (buttons_cell.parentElement !== undefined) buttons_cell.parentElement.style = "display:none";
    if (checkbox_cell.parentElement !== undefined) checkbox_cell.parentElement.style = "display:none";
    document.getElementById("message-cover").style.display = "none";   // enable textarea
    document.getElementById("message").disabled = false;

    if (!window.mobileAndTabletCheck()) m.focus();
};

let select_button = function (text) {
    text = decodeURIComponent(text);

    count();
    send(text);
    if (buttons_cell.parentElement !== undefined) buttons_cell.parentElement.style = "display:none";

    // Enable the text area, but we do not seek that for this task.
    // document.getElementById("message-cover").style.display = "none";
    // document.getElementById("message").disabled = false;

    let m = document.getElementById("message");
    m.value = "";

    if (!window.mobileAndTabletCheck()) m.focus();
};

let count = function (keyCode = 13) {
    // Doing some statistical things here: Counting pauses, typing times...
    let current_time = Date.now();
    if (start_time === 0) {
        start_time = current_time;
        pauses.push(0);  // count pauses
        keys.push(keyCode);
    } else {
        pauses.push(current_time - last_time);  // count pauses
        keys.push(keyCode);
    }
    last_time = current_time;
};

let to_bottom = function () {
    let div = document.getElementById("history-container");
    div.scrollTop = div.scrollHeight;   // go to the bottom
};

let onKeyDown = function (e) {
    e = e || window.event;
    count(e.keyCode);
    if (e.keyCode === 13 && e.shiftKey) {
        return;
    }
    if (e.keyCode === 13) {
        e.returnValue = false;
        click_send();
    }
};

window.mobileAndTabletCheck = function () {
    let check = false;
    (function (a) {
        if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true;
    })(navigator.userAgent || navigator.vendor || window.opera);
    return check;
};

function parse_query_string() {
    let query = window.location.search.substring(1);
    let vars = query.split("&");
    let query_string = {};
    for (let i = 0; i < vars.length; i++) {
        let pair = vars[i].split("=");
        let key = decodeURIComponent(pair[0]);
        let value = decodeURIComponent(pair[1]);
        if (typeof query_string[key] === "undefined") {
            query_string[key] = decodeURIComponent(value);
        } else if (typeof query_string[key] === "string") {
            query_string[key] = [query_string[key], decodeURIComponent(value)];
        } else {
            query_string[key].push(decodeURIComponent(value));
        }
    }
    return query_string;
}


function postStartingMessage() {
    const startingMessages = [
        "This task is about document relevance.",
        "In this task you will be accessing document relevance.",
        "Hi, thank you for choosing our task! In this task you will be assessing document relevance."
    ];

    chatbot.talk([
        {
            msg: startingMessages[textLength]
        },
        {
            buttons: [{
                button: "What does that mean?",
                func: intro
            }]
        },

    ]);
}

function intro() {
    const introMessages = [
        "For this task, you’ll have to give the relevance of a query and a snippet.",
        "Document relevance means that given a snippet of text and a query you should provide their relevance.",
        "When speaking of relevance of a snippet with relation to a query, the relevance denotes how well a retrieved snippet meets the information need of the user that provided the query."
    ];

    if (interactiveness) {
        // The interactive script.
        chatbot.talk([
            {
                msg: introMessages[textLength]
            },
            {
                buttons: [{
                    button: "What is a snippet",
                    func: explainSnippet
                }, {
                    button: "What is a query?",
                    func: explainQuery
                }, {
                    button: "What does relevance mean?",
                    func: explainRelevance
                }, {
                    button: "That makes sense, give me the details.",
                    func: explainScale
                }]
            },
        ]);
    } else {
        // The non-interactive script.
        chatbot.talk([
            {
                msg: introMessages[textLength]
            },
            {
                buttons: [{
                    button: "What is a snippet?",
                    func: explainSnippet
                }]
            },
        ]);
    }
}


function explainSnippet() {
    const messages = [
        "A snippet is simply a part of a larger piece of text. Just select a couple of subsequent sentences from a larger document would be an example of a snippet.",
        "Alright, you would like some more information about a snippet. A snippet is simply a part of a larger piece of text. If you were to take a document and select a couple of subsequent sentences, this would be an example of a snippet.",
        "Alright, you would like some more information about a snippet. A snippet is simply a part of a larger piece of text. If you were to take a document and randomly select a couple of subsequent sentences, this would be an example of a snippet. A snippet is usually what you also see on search engines. On the result page, you do not see the full text of every result, you instead only see a snippet."
    ];

    const snippetExample = "A snippet of a larger text could for example be 'Airplanes come in a variety of sizes, shapes, and wing configurations. The broad spectrum of uses for airplanes includes recreation, transportation of goods and people, military, and research.'";//TODO: <insert snippet 1>

    function showSnippet() {
        // Show snippet example.
        chatbot.talk([{
            msg: snippetExample
        }, {
            buttons: [{
                button: "I understand, lets go back to the problem.",
                func: intro
            }]
        },]);
    }

    if (interactiveness) {
        chatbot.talk([
            {
                msg: messages[textLength]
            },
            {
                buttons: [{
                    button: "What does a snippet look like?",
                    func: showSnippet
                }, {
                    button: "I understand, lets go back to the problem.",
                    func: intro
                }]
            },
        ]);
    } else {
        chatbot.talk([
            {
                msg: messages[textLength]
            },
            {
                msg: snippetExample
            },
            {
                buttons: [{
                    button: "I understand, what is a query?",
                    func: explainQuery
                }]
            },
        ]);
    }
}

function explainQuery() {
    const messages = [
        "A query is something that you would for example enter on a search engine.",
        "A query is something that you would for example enter on a search engine. Your goal is to decide whether a snippet of text is relevant given a query.",
        "A query is something that you would for example enter on a search engine. Your goal is to decide whether a snippet of text is relevant given a query. Queries can be about anything, but should give provide insight about what exactly a search engine user is looking for."
    ];

    const queryExample = "Examples of queries could be; 'how old is the queen', 'trading stocks easily' or 'jet fuel components'";

    function showQueryExample() {
        // Show snippet example.
        chatbot.talk([{
            msg: queryExample
        }, {
            buttons: [{
                button: "I understand, lets go back to the problem.",
                func: intro
            }]
        }]);
    }

    if (interactiveness) {
        chatbot.talk([
            {
                msg: messages[textLength]
            }, {
                buttons: [{
                    button: "What does a query look like?",
                    func: showQueryExample
                }, {
                    button: "I understand, lets go back to the problem.",
                    func: intro
                }]
            },
        ]);
    } else {
        chatbot.talk([
            {
                msg: messages[textLength]
            }, {
                msg: queryExample
            }, {
                buttons: [{
                    button: "I understand, what is relevance?",
                    func: explainRelevance
                }]
            },
        ]);
    }
}

function explainRelevance() {
    const messages = [
        "A snippet is relevant to a query if they are about the same topic. For example consider a snippet about the creation of jet fuel, thereby the query 'jet fuel components' is relevant. A snippet about stock market trading, would however not be relevant.",
        "A snippet is relevant to a query if they are about the same topic. In this case this will be about whether a query is relevant to a snippet of text. For example consider a snippet about the creation of jet fuel, thereby the query 'jet fuel components' is relevant. A snippet about stock market trading, would however not be relevant.",
        "A snippet is relevant to a query if they are about the same topic. In this case this will be about whether a query is relevant to a snippet of text. For example consider a snippet about the creation of jet fuel, thereby the query 'jet fuel components' is relevant. This is obviously relevant, because if there was an article of which the snippet provides details about it, it is likely that the article would mention the desired information. A snippet about stock market trading, would however not be relevant. This is obvious since the query mentions jet fuel components, which are unlike to be found in a snippet about stock market trading."
    ];

    const examples = [
        "For example consider a snippet about the creation of jet fuel, thereby the query 'jet fuel components' is relevant. A snippet about stock market trading, would however not be relevant.",
        "For example consider a snippet about the creation of jet fuel, thereby the query 'jet fuel components' is relevant. A snippet about stock market trading, would however not be relevant.",
        "For example consider a snippet about the creation of jet fuel, thereby the query 'jet fuel components' is relevant. This is obviously relevant, because if there was an article of which the snippet provides details about it, it is likely that the article would mention the desired information. A snippet about stock market trading, would however not be relevant. This is obvious since the query mentions jet fuel components, which are unlike to be found in a snippet about stock market trading."
    ];

    function showRelevanceExample() {
        // Show relevance example.
        chatbot.talk([{
            msg: examples[textLength]
        }, {
            buttons: [{
                button: "I understand, lets go back to the problem.",
                func: intro
            }]
        }]);
    }

    if (interactiveness) {
        chatbot.talk([
            {
                msg: messages[textLength]
            }, {
                buttons: [{
                    button: "Give me a relevance example.",
                    func: showRelevanceExample
                }, {
                    button: "I understand, lets go back to the problem.",
                    func: intro
                }]
            },
        ]);
    } else {
        chatbot.talk([
            {
                msg: messages[textLength]
            }, {
                msg: examples[textLength]
            }, {
                buttons: [{
                    button: "That makes sense, give me the details.",
                    func: explainScale
                }]
            },
        ]);
    }
}

function explainScale() {
    const messages = [
        "Relevance is given on a 4 point scale, 1 is not relevant and 4 is highly relevant.",
        "Relevance is given on a 4 point scale, 1 is not relevant, 2 is vaguely related, 3 is somewhat relevant and 4 is highly relevant.",
        "Relevance is given on a 4 point scale, 1 is not relevant and 4 is highly relevant. For example, something that is not related would get a 1, something vaguely related would get a 2, something related but not a perfect match would receive a 3, and finally the perfect relevance match would get a 4."
    ];

    const scaleExamples = [
        "The following snippet is <b>irrelevant</b> for the query.\n" +
        "<b>Query:</b> \"average building height amsterdam\"\n" +
        "<b>Snippet:</b> \"Non-timber forest products (NTFPs) are useful foods, substances, materials and/or commodities obtained from forests other than timber. Harvest ranges from wild collection to farming. They typically include game animals, fur-bearers, nuts, seeds, berries, mushrooms, oils, sap, foliage, pollarding, medicinal plants, peat, mast, fuelwood, fish, insects, spices, and forage.\"",

        "The following snippet is <b>probably not relevant</b> for the query.\n" +
        "<b>Query:</b> \"temples in europe\"\n" +
        "<b>Snippet:</b> \"The Bhringeswara Shiva temple is situated on the foothills of Dhauli and the left bank of the Daya River, in the southeastern outskirts of Bhubaneswar in the village Khatuapada. The temple is facing towards west and the presiding deity is a circular yoni pitha with a hole at the centre.\"",

        "The following snippet is <b>probably relevant</b> for the query.\n" +
        "<b>Query:</b> \"manager of irvine victoria\"\n" +
        "<b>Snippet:</b> \"Irvine Victoria Football Club is a Scottish football club, based in the town of Irvine, North Ayrshire. Nicknamed Wee Vics and \"Westenders\", it was formed in 1904 and plays at Victoria Park, in Irvine. The team uniform is orange, blue and white stripes. Irvine Victoria play in the West of Scotland League Conference A.\"",

        "The following snippet is <b>relevant</b> for the query.\n" +
        "<b>Query:</b> \"oldest dodge diplomat\"\n" +
        "<b>Snippet:</b> \"The Dodge Diplomat is an American mid-size car that was produced by Dodge from 1977 to 1989. It was built using the same design as the Plymouth Gran Fury in the U.S. market and the Plymouth Caravelle in Canada. It was also sold in Mexico between 1981 and 1982 as the Dodge Dart, and in Colombia as the Dodge Coronet.\""
    ];

    let currentExample = -1;

    function giveExample() {
        currentExample++;

        const talkScript = splitStringIntoBubbles(scaleExamples[currentExample]);

        if (currentExample < scaleExamples.length - 1) {
            if (interactiveness) {
                talkScript.push({
                    buttons: [{
                        button: "Give me another example.",
                        func: giveExample
                    }, {
                        button: "Start the task.",
                        func: task
                    }]
                });
            } else {
                talkScript.push({
                    buttons: [{
                        button: "Alright, give me another example.",
                        func: giveExample
                    }]
                });
            }
        } else {
            talkScript.push({
                buttons: [{
                    button: "Start the task.",
                    func: task
                }]
            });
        }

        // Show the talkScript.
        chatbot.talk(talkScript);
    }

    if (interactiveness) {
        chatbot.talk([
            {
                msg: messages[textLength]
            },
            {
                buttons: [{
                    button: "Alright, give me an example.",
                    func: giveExample
                }, {
                    button: "Start the task.",
                    func: task
                }]
            },
        ]);
    } else {
        chatbot.talk([
            {
                msg: messages[textLength]
            },
            {
                msg: "Now 4 examples will be shown for each entry of the 4 point scale."
            },
            {
                buttons: [{
                    button: "Alright, give me an example.",
                    func: giveExample
                }]
            },
        ]);
    }
}

function splitStringIntoBubbles(string) {
    const talkScript = [];
    const exampleSplit = string.split("\n");
    exampleSplit.forEach(entry => {
        talkScript.push({msg: entry})
    });
    return talkScript
}

let taskNumber = 0;

function task() {
    const tasks = [
        "<b>Query:</b> \"Who is the chairman of Chelsea?\"\n" +
        "<b>Snippet:</b> \"Chelsea Football Club is an English professional football club based in Fulham, London. Founded in 1905, the club competes in the Premier League, the top division of English football. Chelsea are among England's most successful clubs, having won over thirty competitive honours, including six league titles and seven European trophies. Their home ground is Stamford Bridge.\"",
        "<b>Query:</b> \"How large is Canada?\"\n" +
        "<b>Snippet:</b> \"Canada is a country in North America. Its ten provinces and three territories extend from the Atlantic to the Pacific and northward into the Arctic Ocean, covering 9.98 million square kilometres (3.85 million square miles), making it the world's second-largest country by total area. Its southern and western border with the United States, stretching 8,891 kilometres (5,525 mi), is the world's longest bi-national land border. Canada's capital is Ottawa, and its three largest metropolitan areas are Toronto, Montreal, and Vancouver.\"",
        "<b>Query:</b> \"Hockey clubs europe\"\n" +
        "<b>Snippet:</b> \"The Great Lakes Collegiate Hockey League (GLCHL) is an American Collegiate Hockey Association (ACHA) Division I level ice hockey league. The GLCHL is made up of nine schools, eight of which are located in Michigan, with one school in Ohio.\"",
        "<b>Query:</b> \"us militairy pilot fitness\"\n" +
        "<b>Snippet:</b> \"The US Air Force Fitness Test (AFFT) is designed to test the abdominal circumference, muscular strength/endurance and cardiovascular respiratory fitness of airmen in the USAF. As part of the Fit to Fight program, the USAF adopted a more stringent physical fitness assessment; the new fitness program was put into effect on 1 June 2010.\"",
        "<b>Query:</b> \"How many legs does a spider have?\"\n" +
        "<b>Snippet:</b> \"Scorpions have eight legs, and are easily recognized by a pair of grasping pincers and a narrow, segmented tail, often carried in a characteristic forward curve over the back and always ending with a stinger. The evolutionary history of scorpions goes back 435 million years. They mainly live in deserts but have adapted to a wide range of environmental conditions, and can be found on all continents except Antarctica. There are over 2,500 described species, with 22 extant (living) families recognized to date. Their taxonomy is being revised to account for 21st-century genomic studies.\"",
        "<b>Query:</b> \"buy laptop or tablet for child\"\n" +
        "<b>Snippet:</b> \"Around the world, members of Generation Z are spending more time on electronic devices and less time reading books than before, with implications for their attention span, their vocabulary and thus their school grades, as well as their future in the modern economy.\""
    ];

    const talkScript = splitStringIntoBubbles("Task " + (taskNumber + 1) + "/" + tasks.length + "\n" + tasks[taskNumber]);

    function answerTask(relevance) {
        // Store the answer on the task.
        answers.task['Q' + (taskNumber + 1)] = relevance;

        // Increment the task number
        taskNumber++;

        // Check if the worker is done with the tasks
        if (taskNumber < tasks.length) {
            // Continue with the task.
            task();
        } else {
            // Task is complete, start the survey.
            attentionQuestion();
        }
    }

    talkScript.push({
        buttons: [{
            button: "Irrelevant",
            func: () => answerTask(0)
        }, {
            button: "Probably not relevant",
            func: () => answerTask(1)
        }, {
            button: "Probably relevant",
            func: () => answerTask(2)
        }, {
            button: "Relevant",
            func: () => answerTask(3)
        }]
    });

    chatbot.talk(talkScript);
}

let surveyNumber = 0;

function attentionQuestion() {

    function answerAttention(number) {
        answers.attention['A1'] = number;
        survey()
    }

    chatbot.talk([{
        msg: "Now a small question to check if you have been paying attention to the tasks: \"How many legs does a scorpion have?\""
    }, {
        buttons: [{
            button: "Two",
            func: () => answerAttention(2)
        }, {
            button: "Four",
            func: () => answerAttention(4)
        }, {
            button: "Six",
            func: () => answerAttention(6)
        }, {
            button: "Eight",
            func: () => answerAttention(8)
        }]
    }]);

}

function survey() {
    const clarityButtons = ["Very vague", "Vague", "Neutral", "Clear", "Very clear"];
    const influenceButtons = ["No influence", "Slight influence", "Some influence", "Much influence", "Complete influence"];

    const surveys = [{
        survey: "Thank you very much for your valuable contributions!\n" +
        "Now only a small survey is left regarding the clarity of the tasks.\n" +
        "To what extent was the goal or desired outcome of the task clear?",
        buttons: clarityButtons
    }, {
        survey: "To what extent were the steps required to achieve the desired outcome of the task clear?",
        buttons: clarityButtons
    }, {
        survey: "Please rate the overall clarity of the tasks on the following scale.",
        buttons: clarityButtons
    }, {
        survey: "To what extent was your overall task clarity rating influcenced by how clear the goal of the task was?",
        buttons: influenceButtons
    }, {
        survey: "To what extent was your overall task clarity rating influcenced by how clear the steps needed to achieve the goal were?",
        buttons: influenceButtons
    }];

    const talkScript = splitStringIntoBubbles(surveys[surveyNumber].survey);

    function answerSurvey(relevance) {
        // Store the answer on the task.
        answers.survey['S' + (surveyNumber + 1)] = relevance;

        // Increment the task number
        surveyNumber++;

        // Check if the worker is done with the tasks
        if (surveyNumber < surveys.length) {
            // Continue with the task.
            survey();
        } else {
            // Task is complete, start the survey.
            complete();
        }
    }

    // Create the survey buttons from the template.
    let surveyButtons = [];
    surveys[surveyNumber].buttons.forEach((text, index) => {
        surveyButtons.push({
            button: text,
            func: () => answerSurvey(index)
        })
    });

    // Add the survey buttons to the talk script and show the script.
    talkScript.push({buttons: surveyButtons});
    chatbot.talk(talkScript);
}

// Method to time the messages.
let timeStart = (new Date()).getTime();
let timePrevious = timeStart;

function recordUserFlow(button) {
    let timeNow = (new Date()).getTime();

    // Push the time and which button was pressed on the flow array of the user.
    answers.flow.push({
        button: button,
        time: (timeNow - timePrevious),
        timeTotal: (timeNow - timeStart)
    });

    // Set the timePrevious to the time used.
    timePrevious = timeNow;
}

function complete() {
    chatbot.talk([{
        msg: "The task is completed, thank you very much!"
    }, {
        msg: "You are now free to leave the task by clicking the submit button below."
    }]);

    // Send the answers back to Toloka / Sanders personal website for convenience.
    console.log("The answers on the task: ", answers);
    answers['id'] = identifier;
    fetch("https://sander.gielisse.me/confirm_answers", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(answers)
    }).then(res => {
        console.log("Request complete! response:", res);
    });

}

// disable textArea, since we only care about button presses.
document.getElementById("message-cover").style.display = "block";
document.getElementById("message").disabled = true;

// Hyper-parameters setup.
let textLength = 0; //S: 0, M: 1, L: 2
let interactiveness = true;

// The answers provided by the user, and we put the hyper-parameters there in order to not mess up the different types.
let answers = {
    params: {
        textLength: textLength,
        interactiveness: interactiveness
    },
    flow: [],
    task: {},
    attention: {},
    survey: {}
};

let identifier = "%IDENTIFIER%";
console.log("Starting chatbot with identifier ", identifier);

// Start the script.
window.onload = postStartingMessage();
