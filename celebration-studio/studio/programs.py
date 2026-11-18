"""Bilingual editorial programs. A chapter's fields are also the server's input allowlist.
Pages are ordered intentionally; for example, a wedding's story contains its album, and a
housewarming keeps directions with the reply. No invented relatives, dates or ceremony times.
"""


def field(key, kind, en, hi):
    return {
        "key": key,
        "kind": kind,
        "label": [en, hi],
        "limit": {"short": 100, "age": 3, "time": 5, "lines": 600, "note": 700}[kind],
    }


def page(kind, en, hi, intro, hindi, *fields, blocks=()):
    return {
        "kind": kind,
        "title": [en, hi],
        "intro": [intro, hindi],
        "fields": list(fields),
        "blocks": list(blocks),
    }


def album(en, hi, intro, hindi):
    return page(
        "album",
        en,
        hi,
        intro,
        hindi,
        field("memory", "note", "A note for the album", "इन यादों की कहानी"),
        blocks=("gallery",),
    )


def reply(en, hi, intro, hindi, directions=False):
    return page(
        "reply",
        en,
        hi,
        intro,
        hindi,
        field("farewell", "note", "Closing words from the host", "मेज़बान का आखिरी संदेश"),
        blocks=(("venue", "reply") if directions else ("reply",)),
    )


def location(en, hi, intro, hindi):
    return page("location", en, hi, intro, hindi, blocks=("venue", "schedule"))


def program(group, mark, inks, en_note, pages):
    return {
        "group": group,
        "mark": mark,
        "colors": inks.split(),
        "englishMessage": en_note,
        "pages": pages,
    }


PROGRAMS = {
    "birthday": program(
        "Milestones",
        "✸",
        "#83395a #fff2e4 #d57958 #46273e",
        "Save a slice of the day for us! Come for the cake and stay for the people who make every birthday feel like home.",
        [
            page(
                "cover",
                "Happy Birthday!",
                "जन्मदिन मुबारक!",
                "Candles lit. Wishes ready.",
                "मोमबत्तियाँ तैयार हैं, अब आपकी बारी है।",
                field("age", "age", "Age this birthday (optional)", "इस जन्मदिन पर उम्र (वैकल्पिक)"),
            ),
            page(
                "wish-wall",
                "Special birthday wishes",
                "अपनों की शुभकामनाएँ",
                "Little notes from the people who know you best.",
                "परिवार और दोस्तों के दिल से निकले कुछ शब्द।",
                field(
                    "wishes",
                    "lines",
                    "Family & friends’ wishes · one per line",
                    "परिवार और दोस्तों की शुभकामनाएँ · हर पंक्ति पर एक",
                ),
                blocks=("message",),
            ),
            location(
                "Birthday party",
                "जन्मदिन की पार्टी",
                "Keep a place at the party table.",
                "पार्टी का पता, समय और कार्यक्रम यहाँ देखें।",
            ),
            album(
                "Through the years",
                "बचपन से अब तक",
                "From tiny footsteps to today’s smile.",
                "नन्हे कदमों से आज की मुस्कान तक का सफ़र।",
            ),
            page(
                "cake",
                "A birthday surprise",
                "जन्मदिन का सरप्राइज़",
                "Make a wish before the first slice.",
                "केक का पहला टुकड़ा काटने से पहले एक इच्छा माँगें।",
                field("cakeTime", "time", "Cake cutting time (IST)", "केक कटिंग का समय"),
                field("surprise", "note", "Secret birthday message", "सरप्राइज़ संदेश"),
            ),
            reply(
                "Guest RSVP",
                "पार्टी में आएँगे?",
                "Tell us how many slices to save.",
                "बताइए आपके लिए केक के कितने हिस्से रखें।",
            ),
        ],
    ),
    "wedding": program(
        "Milestones",
        "❦",
        "#702e43 #fff4dc #bf8a42 #401c2d",
        "Two families, one new beginning. Join us for the wedding and bring your love and blessings to our first steps together.",
        [
            page(
                "cover",
                "The wedding invitation",
                "शुभ विवाह",
                "Two names, one invitation.",
                "दो नाम, दो परिवार और एक नई शुरुआत।",
                field("partner", "short", "Second partner’s name", "दूसरे जीवनसाथी का नाम"),
            ),
            page(
                "families",
                "Meet the families",
                "दोनों परिवारों का परिचय",
                "With the love and blessings of both families.",
                "दोनों परिवार प्रेम और आदर सहित आपका स्वागत करते हैं।",
                field("familyA", "note", "First family · introduction", "पहले परिवार का परिचय"),
                field("familyB", "note", "Second family · introduction", "दूसरे परिवार का परिचय"),
                blocks=("message",),
            ),
            page(
                "story",
                "Our wedding story",
                "हमारी कहानी",
                "Before the vows, there was a first hello.",
                "सात फेरों से पहले, एक मुलाक़ात की कहानी थी।",
                field("story", "note", "How your story began", "आपकी कहानी की शुरुआत"),
                blocks=("gallery",),
            ),
            page(
                "rites",
                "Wedding functions",
                "शादी के समारोह",
                "Four traditions, each with its own moment.",
                "हर रस्म की अपनी रौनक और अपना समय।",
                *[
                    field(k, "short", en + " · time & place", hi + " · समय और स्थान")
                    for k, en, hi in [
                        ("haldi", "Haldi", "हल्दी"),
                        ("mehndi", "Mehndi", "मेहंदी"),
                        ("sangeet", "Sangeet", "संगीत"),
                        ("vivaah", "Wedding ceremony", "विवाह"),
                    ]
                ],
            ),
            location(
                "Venue & schedule",
                "विवाह स्थल और कार्यक्रम",
                "Meet us at the mandap.",
                "मंडप तक पहुँचने का रास्ता और आयोजन का क्रम।",
            ),
            reply(
                "Blessings & RSVP",
                "आशीर्वाद और उपस्थिति",
                "Your presence will mean the world to both families.",
                "दोनों परिवारों को आपके आगमन और आशीर्वाद का इंतज़ार है।",
            ),
        ],
    ),
    "engagement": program(
        "Milestones",
        "◇",
        "#805440 #fff2ea #c39c50 #492e43",
        "Two rings, one promise. We would love to have you beside us as we celebrate our engagement.",
        [
            page(
                "cover",
                "An engagement in gold",
                "सगाई का निमंत्रण",
                "A promise, set in gold.",
                "सुनहरी अंगूठियों संग एक प्यारा वादा।",
                field("partner", "short", "Partner’s name", "जीवनसाथी का नाम"),
            ),
            page(
                "portraits",
                "Meet the couple",
                "जोड़ी से मिलिए",
                "Two voices at the start of one story.",
                "एक कहानी की शुरुआत, दो लोगों की ज़ुबानी।",
                field("aboutA", "note", "About the first partner", "पहले साथी के बारे में"),
                field("aboutB", "note", "About the second partner", "दूसरे साथी के बारे में"),
                blocks=("message",),
            ),
            page(
                "promise",
                "The ring ceremony",
                "अंगूठियों की रस्म",
                "A little circle with a lifetime inside.",
                "एक छोटी सी अंगूठी में ढेर सारे सपने।",
                field("ringTime", "time", "Ring exchange time (IST)", "अंगूठी पहनाने का समय"),
                field("promise", "note", "A promise or ceremony note", "वादा या समारोह का विवरण"),
            ),
            album(
                "Our inner circle",
                "परिवार और दोस्त",
                "The faces beside us on this day.",
                "इस दिन हमारे साथ खड़े अपनों की झलकियाँ।",
            ),
            location(
                "Location & timing",
                "स्थान और समय",
                "Find the celebration.",
                "सगाई के आयोजन तक पहुँचने की जानकारी।",
            ),
            reply(
                "Congratulations & RSVP",
                "बधाई और उपस्थिति",
                "Leave a wish for the newly engaged couple.",
                "होने वाले जीवनसाथियों के लिए बधाई लिखें।",
            ),
        ],
    ),
    "anniversary": program(
        "Milestones",
        "∞",
        "#805d28 #fff5da #c69547 #483229",
        "Here’s to the years behind us and the chapters still to come. Celebrate our anniversary with us.",
        [
            page(
                "cover",
                "Our anniversary album",
                "सालगिरह का सुनहरा पन्ना",
                "A love story worth keeping.",
                "साथ निभाने की एक सुनहरी कहानी।",
                field("partner", "short", "Partner’s name", "जीवनसाथी का नाम"),
                field("years", "age", "Years together", "साथ बिताए वर्ष"),
            ),
            page(
                "timeline",
                "Our journey",
                "साथ का सफ़र",
                "One milestone at a time.",
                "एक-एक याद से बना हमारा सफ़र।",
                field(
                    "journey",
                    "lines",
                    "Milestones · one year and memory per line",
                    "हर पंक्ति पर एक साल और उसकी याद",
                ),
            ),
            page(
                "wish-wall",
                "Words of love",
                "प्यार भरी शुभकामनाएँ",
                "A toast to the life we have built.",
                "साथ बिताए हर पल के नाम कुछ शब्द।",
                field("wishes", "lines", "Anniversary toasts", "अपनों की शुभकामनाएँ"),
                blocks=("message",),
            ),
            album(
                "Golden memories",
                "सुनहरी यादें",
                "A few pages from our family album.",
                "हमारे एल्बम से चुने कुछ अनमोल पन्ने।",
            ),
            location(
                "The anniversary gathering",
                "सालगिरह का आयोजन",
                "An evening to remember together.",
                "साथ मिलकर यादों को फिर जीने की शाम।",
            ),
            reply(
                "Guest wishes & RSVP",
                "स्नेह संदेश और उपस्थिति",
                "Add a wish for the next chapter.",
                "इस सफ़र के अगले अध्याय के लिए शुभकामना दें।",
            ),
        ],
    ),
    "diwali": program(
        "Festivals",
        "✧",
        "#88501d #fff1cd #e4a03b #50232e",
        "Come light a diya with us this Diwali. May our courtyard be filled with familiar voices, warm light and the sweetness of sharing.",
        [
            page(
                "cover",
                "Festival of lights",
                "शुभ दीपावली",
                "One more lamp for someone we love.",
                "अपनों के नाम एक दीप और।",
            ),
            page(
                "letter",
                "Diwali wishes",
                "दीपावली की शुभकामनाएँ",
                "From our home to yours.",
                "हमारे आँगन से आपके घर तक खुशियों की रोशनी।",
                blocks=("message",),
            ),
            page(
                "lamps",
                "Puja schedule",
                "पूजा और दीपोत्सव",
                "Light the lamps and follow the puja program.",
                "दीप जलाएँ और पूजा का क्रम देखें।",
                field("puja", "lines", "Puja activities & times", "पूजा की रस्में और समय"),
            ),
            album(
                "Lights of home",
                "सजावट और यादें",
                "Rangoli at the door, diyas in every corner.",
                "दहलीज़ की रंगोली, आँगन के दीप और अपनों की यादें।",
            ),
            page(
                "menu",
                "Dinner by lamplight",
                "पार्टी और रात्रिभोज",
                "A place for you at our festive table.",
                "त्योहार की थाली में आपके लिए भी जगह है।",
                field("dinner", "lines", "Dinner & sweets menu", "भोजन और मिठाइयों का मेनू"),
                blocks=("venue", "schedule"),
            ),
            reply(
                "A family invitation",
                "सपरिवार निमंत्रण",
                "Let us know who will join the evening.",
                "बताइए परिवार के कितने सदस्य पधारेंगे।",
            ),
        ],
    ),
    "holi": program(
        "Festivals",
        "✹",
        "#873953 #fff0db #19978c #482441",
        "Bring your brightest smile to our Holi gathering. Let’s share colours, gujiya and an afternoon of laughter.",
        [
            page(
                "cover",
                "A riot of colour",
                "होली का रंगोत्सव",
                "One invitation, a hundred colours.",
                "एक निमंत्रण, खुशियों के सौ रंग।",
            ),
            page(
                "letter",
                "Holi wishes",
                "रंगों भरी शुभकामनाएँ",
                "Signed with a splash of gulal.",
                "गुलाल की छाप संग दिल की बात।",
                blocks=("message",),
            ),
            page(
                "colour-run",
                "The Rangotsav program",
                "रंगोत्सव का कार्यक्रम",
                "Pick a colour and discover the festivities.",
                "रंग चुनें और उत्सव का क्रम देखें।",
                field("rangotsav", "lines", "Colour play, music & timings", "रंग, संगीत और समय"),
            ),
            album(
                "Colour diaries",
                "रंगीन झलकियाँ",
                "Faces, colours and the moments in between.",
                "रंग, मुस्कान और बीच के कुछ यादगार पल।",
            ),
            page(
                "menu",
                "Food & party",
                "पकवान और पार्टी",
                "What’s cooking after the colours?",
                "रंग खेलने के बाद क्या परोसा जाएगा?",
                field(
                    "food",
                    "lines",
                    "Food, drinks & party highlights",
                    "पकवान, पेय और पार्टी की खास बातें",
                ),
                blocks=("venue", "schedule"),
            ),
            reply(
                "Join the colour crew",
                "होली में आपका स्वागत",
                "Count yourself in for the rangotsav.",
                "रंगोत्सव में अपनी उपस्थिति दर्ज करें।",
            ),
        ],
    ),
    "raksha-bandhan": program(
        "Family",
        "✿",
        "#923f32 #fff0d5 #ce8750 #512b31",
        "A thread can hold a whole childhood of memories. Join our family for Raksha Bandhan and a day of being together.",
        [
            page(
                "cover",
                "A bond in thread",
                "रक्षाबंधन का निमंत्रण",
                "For a bond that grows with us.",
                "एक डोर जो उम्र के साथ और मज़बूत होती गई।",
            ),
            page(
                "thread",
                "A sibling’s letter",
                "भाई-बहन का खास संदेश",
                "From one end of the thread to the other.",
                "इस डोर के एक छोर से दूसरे छोर तक।",
                field("sibling", "short", "Sibling’s name", "भाई या बहन का नाम"),
                field("letter", "note", "A personal note to your sibling", "अपना निजी स्नेह संदेश"),
            ),
            page(
                "wish-wall",
                "Rakhi wishes",
                "राखी की शुभकामनाएँ",
                "Words to tie into the knot.",
                "राखी की गाँठ में बाँध लें ये शुभकामनाएँ।",
                field("wishes", "lines", "Family wishes", "परिवार की शुभकामनाएँ"),
                blocks=("message",),
            ),
            album(
                "Childhood scrapbook",
                "बचपन का एल्बम",
                "Shared secrets and summers at home.",
                "साझा शरारतें और बचपन की छुट्टियाँ।",
            ),
            location(
                "The family gathering",
                "परिवार का मिलन",
                "Come home for Rakhi.",
                "राखी पर घर आने की जानकारी।",
            ),
            reply(
                "Greetings & RSVP",
                "शुभकामना और उपस्थिति",
                "Send a greeting and save your seat.",
                "स्नेह संदेश के साथ अपनी उपस्थिति बताएँ।",
            ),
        ],
    ),
    "baby-shower": program(
        "Family",
        "☾",
        "#436b65 #fbf1e5 #d79a97 #3c445c",
        "Our family is making room for a little wonder. Come shower the mother-to-be with kindness and blessings.",
        [
            page(
                "cover",
                "A little wonder",
                "गोद भराई का निमंत्रण",
                "A little guest, a whole sky of love.",
                "नन्हे मेहमान के लिए आसमान भर प्यार।",
            ),
            page(
                "portrait",
                "Meet the mother-to-be",
                "होने वाली माँ का परिचय",
                "A new chapter, in her own words.",
                "एक नया अध्याय, माँ की ज़ुबानी।",
                field("intro", "note", "Mother-to-be’s introduction", "होने वाली माँ का परिचय"),
                blocks=("message",),
            ),
            page(
                "wish-wall",
                "A cradle of blessings",
                "आशीर्वाद और शुभकामनाएँ",
                "Kind words for the growing family.",
                "बढ़ते परिवार के लिए आशीष के बोल।",
                field("blessings", "lines", "Blessings · one per line", "आशीर्वाद · हर पंक्ति पर एक"),
            ),
            page(
                "agenda",
                "Godh bharai ceremony",
                "गोद भराई की रस्में",
                "The rituals and little details of the day.",
                "दिन की रस्में, समय और स्थान।",
                field("ceremony", "lines", "Ceremony highlights", "रस्मों की खास बातें"),
                blocks=("venue", "schedule"),
            ),
            album(
                "Our family album",
                "परिवार की तस्वीरें",
                "Treasures for a little one to look back on.",
                "नन्हे मेहमान के लिए संजोई हुई यादें।",
            ),
            reply(
                "Come shower your love",
                "स्नेह सहित निमंत्रण",
                "Tell us if you can join the family.",
                "बताइए क्या आप इस खुशी में शामिल होंगे।",
            ),
        ],
    ),
    "housewarming": program(
        "Family",
        "⌂",
        "#43604b #f8efdb #bd7542 #374735",
        "A new home becomes our home when loved ones walk through the door. Please join us for our griha pravesh.",
        [
            page(
                "cover",
                "Welcome to our new home",
                "नए घर में स्वागत",
                "A new key and an open door.",
                "नई चाबी, नया घर और खुला दरवाज़ा।",
                field("house", "short", "House name (optional)", "घर का नाम"),
            ),
            page(
                "portrait",
                "Meet our family",
                "हमारे परिवार से मिलें",
                "Meet the people who make this place home.",
                "जिनसे यह मकान घर बनता है, उनसे मिलिए।",
                field("family", "note", "Introduce your family", "अपने परिवार का परिचय"),
            ),
            page(
                "letter",
                "Griha pravesh invitation",
                "गृह प्रवेश का निमंत्रण",
                "From our doorstep to yours.",
                "हमारी चौखट से स्नेह भरा बुलावा।",
                blocks=("message",),
            ),
            page(
                "lamps",
                "Puja & havan",
                "पूजा और हवन का क्रम",
                "Join us for the first rituals in our new home.",
                "नए घर की पहली पूजा में हमारे साथ बैठें।",
                field("havan", "lines", "Puja, havan & timings", "पूजा, हवन और समय"),
                blocks=("schedule",),
            ),
            album(
                "A tour of our home",
                "नए घर की झलक",
                "Corners we cannot wait to share.",
                "घर के वे कोने जो हम आपको दिखाना चाहते हैं।",
            ),
            reply(
                "Directions & RSVP",
                "पता, नक्शा और उपस्थिति",
                "Find our new address and tell us you’re coming.",
                "हमारा नया पता देखें और आने की सूचना दें।",
                True,
            ),
        ],
    ),
    "festival-party": program(
        "Festivals",
        "✷",
        "#65509a #f3edf9 #e36ba5 #201b3f",
        "Your name is on the guest list. Join our festival party for music, conversation and a night to remember.",
        [
            page(
                "cover",
                "Your backstage pass",
                "पार्टी में स्वागत",
                "One pass to the dance floor.",
                "डांस फ़्लोर तक आपका पास।",
            ),
            page(
                "letter",
                "The special invitation",
                "एक खास बुलावा",
                "A personal note before the lights go up.",
                "लाइटें जगमगाने से पहले, आपके नाम एक संदेश।",
                blocks=("message",),
            ),
            page(
                "setlist",
                "Tonight’s set list",
                "पार्टी का कार्यक्रम",
                "The running order for the night.",
                "शाम के कार्यक्रमों की पूरी लय।",
                field("lineup", "lines", "Acts, music & set times", "प्रस्तुतियाँ और समय"),
            ),
            album(
                "Party highlights",
                "पार्टी की झलकियाँ",
                "A highlight reel for the guest list.",
                "हमारे जश्न की तस्वीरें और वीडियो।",
            ),
            location(
                "Meet at the venue",
                "पार्टी का पता",
                "Here’s where the music starts.",
                "जहाँ संगीत की शुरुआत होगी, वह स्थान।",
            ),
            reply(
                "Guest confirmation",
                "अपना पास पक्का करें",
                "Tell the host how many are in your crew.",
                "मेज़बान को अपने समूह की संख्या बताएँ।",
            ),
        ],
    ),
    "karwa-chauth": program(
        "Festivals",
        "☽",
        "#81435c #fcf0e9 #ac8d56 #35223e",
        "Join us under the moon for an evening of love and togetherness this Karwa Chauth.",
        [
            page(
                "cover",
                "Beneath the moon",
                "चाँदनी का निमंत्रण",
                "An evening in silver and rose.",
                "चाँदनी और स्नेह से सजी एक शाम।",
            ),
            page(
                "letter",
                "A moonlit wish",
                "चाँदनी संदेश",
                "For the bonds we cherish.",
                "उन रिश्तों के नाम जो दिल के करीब हैं।",
                blocks=("message",),
            ),
            page(
                "rites",
                "Evening rituals",
                "शाम की रस्में",
                "An evening shaped by family traditions.",
                "अपनों की परंपराओं से सजी शाम।",
                field("rituals", "lines", "Rituals and timings", "रस्में और समय"),
            ),
            album(
                "Moonlight memories",
                "चाँदनी की यादें",
                "Keepsakes from our evenings together.",
                "साथ बिताई शामों की कुछ झलकियाँ।",
            ),
            location(
                "The gathering", "शाम का मिलन", "Meet us for moonrise.", "चाँद के स्वागत में साथ मिलें।"
            ),
            reply(
                "Love & RSVP",
                "स्नेह और उपस्थिति",
                "Let us know if you can come.",
                "हमारे साथ इस शाम को मनाने का जवाब दें।",
            ),
        ],
    ),
    "new-year": program(
        "Festivals",
        "✺",
        "#304c66 #edf4f4 #c59a56 #182b41",
        "Let’s turn the page on a new year together. Join us for the countdown and the first wishes of the year.",
        [
            page(
                "cover",
                "At the stroke of midnight",
                "नव वर्ष का निमंत्रण",
                "A new year begins with us.",
                "नए साल की शुरुआत हमारे साथ।",
            ),
            page(
                "letter",
                "New year wishes",
                "नव वर्ष संदेश",
                "A little hope for the year ahead.",
                "आने वाले साल के लिए एक नई उम्मीद।",
                blocks=("message",),
            ),
            page(
                "setlist",
                "Countdown program",
                "उलटी गिनती का कार्यक्रम",
                "The moments leading to midnight.",
                "आधी रात से पहले के खास पल।",
                field("countdownPlan", "lines", "Countdown activities", "नव वर्ष की गतिविधियाँ"),
            ),
            album(
                "The year in pictures",
                "साल की यादें",
                "The year we leave behind, in photographs.",
                "बीते साल की तस्वीरों का सफ़र।",
            ),
            location(
                "New year’s eve",
                "नए साल की शाम",
                "Where to raise a toast.",
                "मिलकर नए साल का स्वागत कहाँ करें।",
            ),
            reply(
                "Count me in",
                "जश्न में शामिल हों",
                "Add your name to the countdown.",
                "उलटी गिनती में अपना नाम जोड़ें।",
            ),
        ],
    ),
    "christmas": program(
        "Festivals",
        "✶",
        "#315d4a #fcf2df #b45658 #183e36",
        "Come in from the cold for carols, festive treats and a Christmas gathering filled with warmth.",
        [
            page(
                "cover",
                "A Christmas gathering",
                "क्रिसमस का निमंत्रण",
                "A star is lit for you.",
                "आपके नाम एक सितारा जगमगाया है।",
            ),
            page(
                "letter",
                "Christmas wishes",
                "क्रिसमस की शुभकामनाएँ",
                "With warmth from our family.",
                "हमारे परिवार की ओर से ढेर सारा प्यार।",
                blocks=("message",),
            ),
            page(
                "setlist",
                "Carols & festivities",
                "कैरल और उत्सव",
                "What’s playing under the tree.",
                "क्रिसमस ट्री के पास क्या होगा खास।",
                field("carols", "lines", "Carols & activities", "कैरल और कार्यक्रम"),
            ),
            album(
                "Under the tree",
                "क्रिसमस की यादें",
                "A keepsake of the season.",
                "इस त्योहार की मुस्कानें संजो लें।",
            ),
            page(
                "menu",
                "Christmas supper",
                "क्रिसमस का भोजन",
                "Our festive table awaits.",
                "त्योहार के भोजन पर आपका स्वागत है।",
                field("supper", "lines", "Supper menu", "भोजन का मेनू"),
                blocks=("venue", "schedule"),
            ),
            reply(
                "Season’s greetings & RSVP",
                "शुभकामना और उपस्थिति",
                "Tell us who to set a place for.",
                "बताइए साथ कितने मेहमान आएँगे।",
            ),
        ],
    ),
}


def allowed_fields(occasion):
    return {f["key"]: f for chapter in PROGRAMS[occasion]["pages"] for f in chapter["fields"]}
