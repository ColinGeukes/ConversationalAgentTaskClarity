// TODO: Implement Toloka tasks as they would like it.
// exports.Task = extend(TolokaHandlebarsTask, function (options) {
//     TolokaHandlebarsTask.call(this, options);
// }, {
//     onRender: function () {
//         // DOM element for task is formed (available via #getDOMElement())
//     },
//     onDestroy: function () {
//         // Task is completed. Global resources can be released (if used)
//     }
// });
//
// function extend(ParentClass, constructorFunction, prototypeHash) {
//     constructorFunction = constructorFunction || function () {
//     };
//     prototypeHash = prototypeHash || {};
//     if (ParentClass) {
//         constructorFunction.prototype = Object.create(ParentClass.prototype);
//     }
//     for (var i in prototypeHash) {
//         constructorFunction.prototype[i] = prototypeHash[i];
//     }
//     return constructorFunction;
// }

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

let userid = "";
let answers = [];
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
                    button: "What is a snippet",
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

    const snippetExample = "A snippet of a larger text could for example be";//TODO: <insert snippet 1>

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
                    button: "I understand, continue.",
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
                    button: "I understand, continue.",
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

    const relevanceExample = "Examples of queries could be: 'how old is the queen'; 'trading stocks easily'; or, 'jet fuel components'"; //TODO: THis is not the correct example

    if (interactiveness) {
        chatbot.talk([
            {
                msg: messages[textLength]
            }, {
                msg: relevanceExample
            }, {
                buttons: [{
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
                msg: relevanceExample
            }, {
                buttons: [{
                    button: "I understand, continue.",
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

    chatbot.talk([
        {
            msg: messages[textLength]
        },
        {
            buttons: [{
                button: "Alright, give me an example.",
                func: () => {
                    console.error("GIVE EXAMPLE: NOT IMPLEMENTED")
                }
            }, {
                button: "Start the task.",
                func: () => {
                    console.error("START THE TASK: NOT IMPLEMENTED")
                }
            }]
        },
    ]);
}

// disable textarea, since we only care about button presses.
document.getElementById("message-cover").style.display = "block";
document.getElementById("message").disabled = true;

// Hyper-parameters setup.
let textLength = 2; //S: 0, M: 1, L: 2
let interactiveness = false;

// Start the script.
window.onload = postStartingMessage()();