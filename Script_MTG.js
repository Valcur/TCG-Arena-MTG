const fs = require('fs');
const readline = require('readline');

let lastLoadedCard = "NONE";

const formats = [
    {
        title: "commander",
        code: "EDH"
    },
    {
        title: "modern",
        code: "MD"
    },
    {
        title: "vintage",
        code: "VI"
    },
    {
        title: "standard",
        code: "ST"
    },
    {
        title: "pauper",
        code: "PA"
    },
    {
        title: "legacy",
        code: "LG"
    },
    {
        title: "pioneer",
        code: "PI"
    }
]

function countCost(str) {
    if (!str) return 0;
    const matches = str.match(/\{([^}]+)\}/g);
    if (!matches) return 0;
    return matches.reduce((sum, token) => {
        const content = token.slice(1, -1);
        if (!isNaN(content)) return sum + parseInt(content, 10);
        if (content === 'X') return sum;
        return sum + 1;
    }, 0);
}

function getCardType(typeLine, setType, name) {
    const t = typeLine.toLowerCase();
    if (t.includes("battle")) return "Battle";
    if (t.includes("creature")) return "Creature";
    if (t.includes("land") && !t.includes("lander")) return "Land";
    if (t.includes("attraction")) return "Artifact - Attraction";
    if (t.includes("artifact")) return "Artifact";
    if (t.includes("enchantment — aura")) return "Enchantment - Aura";
    if (t.includes("enchantment")) return "Enchantment";
    if (t.includes("instant")) return "Instant";
    if (t.includes("sorcery")) return "Sorcery";
    if (t.includes("planeswalker")) return "Planeswalker";
    if (t.includes("emblem")) return "Emblem";
    if (t.includes("card") && !setType.includes("memorabilia") && !setType.includes("minigame") && !name.includes("Checklist")) return "Card";
    return "Other";
}

function getImages(c) {
    let colors = [], image = {};
    if (c.card_faces && c.card_faces[0].image_uris) {
        image.front = c.card_faces[0].image_uris.normal;
        image.back = c.card_faces[1].image_uris.normal;
        colors = [...c.card_faces[0].colors];
        c.card_faces[1].colors.forEach(color => {
            if (!colors.includes(color)) colors.push(color);
        });
    } else {
        image.front = c.image_uris.normal;
        colors = c.colors;
    }
    return { image, colors };
}

function getPowerToughness(value) {
    if (!value || /[+\-.*?∞]/.test(value)) return 0;
    return Math.trunc(value);
}

const setCustomLegality = (card, value, force) => {
    formats.forEach(f => {
        card._legal[f.code] = force || card._legal[f.code] === true ? value : false
    })
}

const handleLegalityOveride = (newCard, oracle_id) => {
    // Legality override
    if ([
        "47e191f7-6314-4875-b5ee-57e5daf089c4", // Dragon's approach
        "3c1619bd-db5e-4df6-a196-0a9d62374f6d", // Hare apparent
        "0e488c6c-aae2-450f-b969-7bb5a1b37a66", // Persistent petioner
        "ec77d23b-0165-450d-9aae-73b755163753", // Rat colony
        "104ea189-14cd-420f-afdc-57b0f827ab8e", // Relentless rats
        "595a15f0-77f3-4544-8acc-10630e12cc14", // Shadowborn apostle
        "b53597f4-1a0f-4fa8-9c17-29178cdc4d2b", // Slime against humanity
        "7423b3b9-56eb-4cf2-8ada-135918219c4b", // Tempest hawk
        "f9453fe2-fadf-4cd4-8d2c-0eaa0e2d78d6", // Templar knigh
        "87050537-99c9-4993-a770-4329b2e749e4"  // Cid, Timeless artificier
    ].includes(oracle_id)) {
        setCustomLegality(newCard, 200)
    }

    // Nazgul
    if (oracle_id === "48a62778-7c11-486f-a0e1-020c283a7ef9") {
        setCustomLegality(newCard, 9)
    }
    //48a62778-7c11-486f-a0e1-020c283a7ef9 nazgul

    // Seven dwarf
    if (oracle_id === "526ca4a9-3f50-4f7a-8169-2bda95792401") {
        setCustomLegality(newCard, 7)
    }

    // Basic lands
    if ([
        "05d24b0c-904a-46b6-b42a-96a4d91a0dd4", // Wastes
        "56719f6a-1a6c-4c0a-8d21-18f7d7350b68", // Swamp
        "a3fb7228-e76b-4e96-a40e-20b5fed75685", // Mountain
        "b2c6aa39-2d2a-459c-a555-fb48ba993373", // Island
        "b34bb2dc-c1af-4d77-b0b3-a0fb342a5fc6", // Forest
        "bc71ebf6-2056-41f7-be35-b2e5c34afa99", // Plains

        "46a07b53-ff58-4bd6-80dd-ded2eb0e29a3", // Snow Wastes
        "d8239a86-7184-4005-ba1e-2dddcd756c47", // Snow Swamp
        "ca9f660b-e07d-4f42-a46e-abd0ca72510c", // Snow Mountain
        "5b2460a5-6ae5-4cad-ba94-1a9e98e6e4c0", // Snow Island
        "5f0d3be8-e63e-4ade-ae58-6b0c14f2ce6d", // Snow Forest
        "ac8cc74d-e43b-4118-bba0-dfa8b9c04d45", // Snow Plains

        "195287aa-cdb6-496f-b796-2bfdc7a6e0c9"  // Barry"s land
    ].includes(oracle_id)) {
        setCustomLegality(newCard, 99)
    }
}

const handleSplitBack = (newCard, c, image) => {
    // Gestion des cartes split/back
    if (c.card_faces) {
        const splitType = c.type_line.split(' // ');
        const splitName = c.name.split(' // ');

        const typeFront = getCardType(splitType[0], c.set_type, c.name);
        newCard.face = {
            front: {
                name: splitName[0],
                type: typeFront,
                cost: Math.trunc(countCost(c.card_faces[0].mana_cost)),
                isHorizontal: typeFront == "Battle",
                image: image.front
            }
        };

        if (c.card_faces.length === 2 && splitType.length === 2 && splitName.length === 2 && image.back) {
            const typeBack = getCardType(splitType[1], c.set_type, c.name);
            newCard.face.back = {
                name: splitName[1],
                type: typeBack,
                cost: Math.trunc(countCost(c.card_faces[1].mana_cost)),
                isHorizontal: typeBack == "Battle",
                image: image.back
            };
        }

        if (c.layout == "split" || c.layout == "adventure") {
            newCard.face.front.isHorizontal = !(c.keywords.includes("Aftermath") || c.layout == "adventure")
            //cost: Math.trunc(c.cmc),
        }
    }
}

function modifyJsonFile(inputFilePath, outputFilePath, allCardsPath) {
    console.log("Étape 1 : Indexation native de allCards ligne par ligne (veuillez patienter)...");
    const allCards = {};

    const rl = readline.createInterface({
        input: fs.createReadStream(allCardsPath),
        crlfDelay: Infinity
    });

    const idRegex = /"id"\s*:\s*"([^"]+)"/;
    const oracleIdRegex = /"oracle_id"\s*:\s*"([^"]+)"/;

    let currentId = null;

    rl.on('line', (line) => {
        const idMatch = line.match(idRegex);
        if (idMatch) {
            currentId = idMatch[1];
        }

        const oracleMatch = line.match(oracleIdRegex);
        if (oracleMatch && currentId) {
            allCards[currentId] = oracleMatch[1];
            currentId = null; // Reset pour la prochaine carte
        }
    });

    rl.on('close', () => {
        const result = {};
        const rlOracle = readline.createInterface({
            input: fs.createReadStream(inputFilePath),
            crlfDelay: Infinity
        });

        rlOracle.on('line', (line) => {
            if (!line.trim()) return;

            let c;
            try {
                c = JSON.parse(line);
            } catch (e) {
                console.error('Erreur parsing ligne oracle:', e.message);
                return;
            }

            lastLoadedCard = c;
            const { image, colors } = getImages(c);
            const type = getCardType(c.type_line, c.set_type, c.name);
            const cost = c.cmc ? Math.trunc(c.cmc) : 0
            const newCard = {
                id: c.oracle_id,
                name: c.name,
                type,
                face: {
                    front: {
                        name: c.name,
                        type,
                        cost: cost,
                        isHorizontal: c.layout == "split" || type == "Battle",
                        image: image.front
                    }
                },
                Colors: colors,
                "Card type": c.type_line,
                "Color identity": c.color_identity,
                set: c.set,
                isHorizontal: c.layout == "split" || type == "Battle",
                cost: cost,
                _legal: {}
            };

            formats.forEach(f => {
                newCard._legal[f.code] = c.legalities[f.title] === "legal"
            })

            if (c.power) newCard.power = getPowerToughness(c.power);
            if (c.toughness) newCard.toughness = getPowerToughness(c.toughness);

            handleLegalityOveride(newCard, c.oracle_id)

            handleSplitBack(newCard, c, image)

            if (c.type_line.includes("oken") || c.set_type === "token" || type === "Emblem" || type === "Card") {
                newCard.isToken = true;
                setCustomLegality(newCard, true, true)
            }

            if (c.all_parts) {
                const tokens = c.all_parts
                    .filter(p => (p.component === "token" || p.type_line.includes("Dungeon")) && allCards[p.id])
                    .map(p => allCards[p.id]);
                if (tokens.length) newCard.tokens = tokens;
            }

            if (type != "Other" && c.layout != "art_series" && !c.name.includes(" // Wanted!")) {
                result[c.oracle_id] = newCard;
            } else if (c.type_line.includes("Dungeon")) {
                result[c.oracle_id] = newCard;
            }
        });

        addTreacheryCards(result)

        rlOracle.on('close', () => {
            fs.writeFile(outputFilePath, JSON.stringify(result, null, 2), 'utf8', (err) => {
                if (err) console.error('Erreur écriture output JSON:', err);
                else {
                    console.log(`Fichier sauvegardé: ${outputFilePath}, total cartes: ${Object.keys(result).length}`);
                    increaseGameVersion()
                }
            });
        });

        rlOracle.on('error', (err) => {
            console.error('Erreur lecture oracle JSONL:', err.message);
        });
    });
}

function increaseGameVersion() {
    const gameJsonPath = './Game_MTG.json';

    try {
        // 1. Lecture
        const data = fs.readFileSync(gameJsonPath, 'utf8');
        const gameConfig = JSON.parse(data);

        // 2. Incrémentation
        if (gameConfig.cards) {
            const oldVersion = gameConfig.cards.version || 0;
            gameConfig.cards.version = oldVersion + 1;

            // 3. Écriture
            fs.writeFileSync(gameJsonPath, JSON.stringify(gameConfig, null, 2), 'utf8');
            console.log(`✅ Game json mis à jour : v${oldVersion} -> v${gameConfig.cards.version}`);
            return gameConfig.cards.version;
        } else {
            console.error("❌ Erreur : La clé 'cards' n'existe pas dans Game.json");
        }
    } catch (err) {
        console.error('❌ Erreur lors de la mise à jour de Game.json:', err.message);
    }
}

// Utilisation
//modifyJsonFile('oracle.json', 'MTGCards.json', 'all.json');
module.exports = modifyJsonFile;






function addTreacheryCards(cardList) {
    for (const [subtype, cards] of Object.entries(treacheryData)) {

        for (const card of cards) {
            const cardId = "treachery-" + card.id
            const c = {
                id: cardId,
                name: card.name,
                type: "Emblem",
                isToken: false,
                cost: card.cmc,
                face: {
                    front: {
                        name: card.name,
                        image: card.image,
                        type: "Emblem"
                    }
                },
                Colors: [],
                "Card type": "Emblem",
                "Color identity": [],
                set: "Treachery",
                isHorizontal: false,
                _legal: {}
            }
            setCustomLegality(c, false)
            c._legal.EDH = true
            cardList[cardId] = c
        }
    }
}




const treacheryData = {
    "Guardian": [
        {
            "id": 1,
            "name": "The Ætherist",
            "cmc": 0,
            "rarity": "R",
            "image": "https://mtgtreachery.net/images/cards/en/trd/001%20-%20Guardian%20-%20The%20Ætherist.jpg"
        },
        {
            "id": 2,
            "name": "The Augur",
            "cmc": 0,
            "rarity": "R",
            "image": "https://mtgtreachery.net/images/cards/en/trd/002%20-%20Guardian%20-%20The%20Augur.jpg"
        },
        {
            "id": 3,
            "name": "The Bodyguard",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/003%20-%20Guardian%20-%20The%20Bodyguard.jpg"
        },
        {
            "id": 4,
            "name": "The Cathar",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/004%20-%20Guardian%20-%20The%20Cathar.jpg"
        },
        {
            "id": 5,
            "name": "The Cryomancer",
            "cmc": 0,
            "rarity": "R",
            "image": "https://mtgtreachery.net/images/cards/en/trd/005%20-%20Guardian%20-%20The%20Cryomancer.jpg"
        },
        {
            "id": 6,
            "name": "The Flickering Mage",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/006%20-%20Guardian%20-%20The%20Flickering%20Mage.jpg"
        },
        {
            "id": 7,
            "name": "The Golem",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/007%20-%20Guardian%20-%20The%20Golem.jpg"
        },
        {
            "id": 8,
            "name": "The Great Martyr",
            "cmc": 0,
            "rarity": "M",
            "image": "https://mtgtreachery.net/images/cards/en/trd/008%20-%20Guardian%20-%20The%20Great%20Martyr.jpg"
        },
        {
            "id": 9,
            "name": "The Immortal",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/009%20-%20Guardian%20-%20The%20Immortal.jpg"
        },
        {
            "id": 10,
            "name": "The Inquisitor",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/010%20-%20Guardian%20-%20The%20Inquisitor.jpg"
        },
        {
            "id": 11,
            "name": "The Marshal",
            "cmc": 0,
            "rarity": "R",
            "image": "https://mtgtreachery.net/images/cards/en/trd/011%20-%20Guardian%20-%20The%20Marshal.jpg"
        },
        {
            "id": 12,
            "name": "The Mirror Maestra",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/012%20-%20Guardian%20-%20The%20Mirror%20Maestra.jpg"
        },
        {
            "id": 13,
            "name": "The Oracle",
            "cmc": 0,
            "rarity": "M",
            "image": "https://mtgtreachery.net/images/cards/en/trd/013%20-%20Guardian%20-%20The%20Oracle.jpg"
        },
        {
            "id": 14,
            "name": "The Quellmaster",
            "cmc": 0,
            "rarity": "R",
            "image": "https://mtgtreachery.net/images/cards/en/trd/014%20-%20Guardian%20-%20The%20Quellmaster.jpg"
        },
        {
            "id": 15,
            "name": "The Spellsnatcher",
            "cmc": 0,
            "rarity": "R",
            "image": "https://mtgtreachery.net/images/cards/en/trd/015%20-%20Guardian%20-%20The%20Spellsnatcher.jpg"
        },
        {
            "id": 16,
            "name": "The Summoner",
            "cmc": 0,
            "rarity": "R",
            "image": "https://mtgtreachery.net/images/cards/en/trd/016%20-%20Guardian%20-%20The%20Summoner.jpg"
        },
        {
            "id": 17,
            "name": "The Supplier",
            "cmc": 0,
            "rarity": "M",
            "image": "https://mtgtreachery.net/images/cards/en/trd/017%20-%20Guardian%20-%20The%20Supplier.jpg"
        },
        {
            "id": 18,
            "name": "The Warlock",
            "cmc": 0,
            "rarity": "M",
            "image": "https://mtgtreachery.net/images/cards/en/trd/018%20-%20Guardian%20-%20The%20Warlock.jpg"
        }
    ],
    "Traitor": [
        {
            "id": 19,
            "name": "The Banisher",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/019%20-%20Traitor%20-%20The%20Banisher.jpg"
        },
        {
            "id": 20,
            "name": "The Cleaner",
            "cmc": 0,
            "rarity": "R",
            "image": "https://mtgtreachery.net/images/cards/en/trd/020%20-%20Traitor%20-%20The%20Cleaner.jpg"
        },
        {
            "id": 21,
            "name": "The Ferryman",
            "cmc": 0,
            "rarity": "M",
            "image": "https://mtgtreachery.net/images/cards/en/trd/021%20-%20Traitor%20-%20The%20Ferryman.jpg"
        },
        {
            "id": 22,
            "name": "The Gatekeeper",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/022%20-%20Traitor%20-%20The%20Gatekeeper.jpg"
        },
        {
            "id": 23,
            "name": "The Grenadier",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/023%20-%20Traitor%20-%20The%20Grenadier.jpg"
        },
        {
            "id": 24,
            "name": "He Who Comes To Save The Day",
            "cmc": 0,
            "rarity": "M",
            "image": "https://mtgtreachery.net/images/cards/en/trd/024%20-%20Traitor%20-%20He%20Who%20Comes%20To%20Save%20The%20Day.jpg"
        },
        {
            "id": 25,
            "name": "The Metamorph",
            "cmc": 0,
            "rarity": "S",
            "image": "https://mtgtreachery.net/images/cards/en/trd/025%20-%20Traitor%20-%20The%20Metamorph.jpg"
        },
        {
            "id": 26,
            "name": "The Oneiromancer",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/026%20-%20Traitor%20-%20The%20Oneiromancer.jpg"
        },
        {
            "id": 27,
            "name": "The Puppet Master",
            "cmc": 0,
            "rarity": "S",
            "image": "https://mtgtreachery.net/images/cards/en/trd/027%20-%20Traitor%20-%20The%20Puppet%20Master.jpg"
        },
        {
            "id": 28,
            "name": "The Reflector",
            "cmc": 0,
            "rarity": "R",
            "image": "https://mtgtreachery.net/images/cards/en/trd/028%20-%20Traitor%20-%20The%20Reflector.jpg"
        },
        {
            "id": 29,
            "name": "The Time Bender",
            "cmc": 0,
            "rarity": "R",
            "image": "https://mtgtreachery.net/images/cards/en/trd/029%20-%20Traitor%20-%20The%20Time%20Bender.jpg"
        },
        {
            "id": 30,
            "name": "The Treacherous Masochist",
            "cmc": 0,
            "rarity": "S",
            "image": "https://mtgtreachery.net/images/cards/en/trd/030%20-%20Traitor%20-%20The%20Treacherous%20Masochist.jpg"
        },
        {
            "id": 31,
            "name": "The Wearer of Masks",
            "cmc": 0,
            "rarity": "S",
            "image": "https://mtgtreachery.net/images/cards/en/trd/031%20-%20Traitor%20-%20The%20Wearer%20of%20Masks.jpg"
        }
    ],
    "Assassin": [
        {
            "id": 32,
            "name": "The Ambitious Queen",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/032%20-%20Assassin%20-%20The%20Ambitious%20Queen.jpg"
        },
        {
            "id": 33,
            "name": "The Beastmaster",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/033%20-%20Assassin%20-%20The%20Beastmaster.jpg"
        },
        {
            "id": 34,
            "name": "The Bio-Engineer",
            "cmc": 0,
            "rarity": "M",
            "image": "https://mtgtreachery.net/images/cards/en/trd/034%20-%20Assassin%20-%20The%20Bio-Engineer.jpg"
        },
        {
            "id": 35,
            "name": "The Chaos Wielder",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/035%20-%20Assassin%20-%20The%20Chaos%20Wielder.jpg"
        },
        {
            "id": 36,
            "name": "The Corpse Snatcher",
            "cmc": 0,
            "rarity": "R",
            "image": "https://mtgtreachery.net/images/cards/en/trd/036%20-%20Assassin%20-%20The%20Corpse%20Snatcher.jpg"
        },
        {
            "id": 37,
            "name": "The Demon",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/037%20-%20Assassin%20-%20The%20Demon.jpg"
        },
        {
            "id": 38,
            "name": "The Depths Caller",
            "cmc": 0,
            "rarity": "M",
            "image": "https://mtgtreachery.net/images/cards/en/trd/038%20-%20Assassin%20-%20The%20Depths%20Caller.jpg"
        },
        {
            "id": 39,
            "name": "The Madwoman",
            "cmc": 0,
            "rarity": "R",
            "image": "https://mtgtreachery.net/images/cards/en/trd/039%20-%20Assassin%20-%20The%20Madwoman.jpg"
        },
        {
            "id": 40,
            "name": "The Necromancer",
            "cmc": 0,
            "rarity": "R",
            "image": "https://mtgtreachery.net/images/cards/en/trd/040%20-%20Assassin%20-%20The%20Necromancer.jpg"
        },
        {
            "id": 41,
            "name": "The Physician",
            "cmc": 0,
            "rarity": "R",
            "image": "https://mtgtreachery.net/images/cards/en/trd/041%20-%20Assassin%20-%20The%20Physician.jpg"
        },
        {
            "id": 42,
            "name": "The Pyromancer",
            "cmc": 0,
            "rarity": "R",
            "image": "https://mtgtreachery.net/images/cards/en/trd/042%20-%20Assassin%20-%20The%20Pyromancer.jpg"
        },
        {
            "id": 43,
            "name": "The Rebel General",
            "cmc": 0,
            "rarity": "R",
            "image": "https://mtgtreachery.net/images/cards/en/trd/043%20-%20Assassin%20-%20The%20Rebel%20General.jpg"
        },
        {
            "id": 44,
            "name": "The Seer",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/044%20-%20Assassin%20-%20The%20Seer.jpg"
        },
        {
            "id": 45,
            "name": "The Shapeshifting Slayer",
            "cmc": 0,
            "rarity": "M",
            "image": "https://mtgtreachery.net/images/cards/en/trd/045%20-%20Assassin%20-%20The%20Shapeshifting%20Slayer.jpg"
        },
        {
            "id": 46,
            "name": "The Sigil Mage",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/046%20-%20Assassin%20-%20The%20Sigil%20Mage.jpg"
        },
        {
            "id": 47,
            "name": "The Sorceress",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/047%20-%20Assassin%20-%20The%20Sorceress.jpg"
        },
        {
            "id": 48,
            "name": "The Villain",
            "cmc": 0,
            "rarity": "R",
            "image": "https://mtgtreachery.net/images/cards/en/trd/048%20-%20Assassin%20-%20The%20Villain.jpg"
        },
        {
            "id": 49,
            "name": "The War Shaman",
            "cmc": 0,
            "rarity": "R",
            "image": "https://mtgtreachery.net/images/cards/en/trd/049%20-%20Assassin%20-%20The%20War%20Shaman.jpg"
        }
    ],
    "Leader": [
        {
            "id": 50,
            "name": "The Blood Empress",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/050%20-%20Leader%20-%20The%20Blood%20Empress.jpg"
        },
        {
            "id": 51,
            "name": "The Chaos Bringer",
            "cmc": 0,
            "rarity": "M",
            "image": "https://mtgtreachery.net/images/cards/en/trd/051%20-%20Leader%20-%20The%20Chaos%20Bringer.jpg"
        },
        {
            "id": 52,
            "name": "The Corrupted Regent",
            "cmc": 0,
            "rarity": "R",
            "image": "https://mtgtreachery.net/images/cards/en/trd/052%20-%20Leader%20-%20The%20Corrupted%20Regent.jpg"
        },
        {
            "id": 53,
            "name": "The Debt Collector",
            "cmc": 0,
            "rarity": "M",
            "image": "https://mtgtreachery.net/images/cards/en/trd/053%20-%20Leader%20-%20The%20Debt%20Collector.jpg"
        },
        {
            "id": 54,
            "name": "The Gathering",
            "cmc": 0,
            "rarity": "M",
            "image": "https://mtgtreachery.net/images/cards/en/trd/054%20-%20Leader%20-%20The%20Gathering.jpg"
        },
        {
            "id": 55,
            "name": "Her Seedborn Highness",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/055%20-%20Leader%20-%20Her%20Seedborn%20Highness.jpg"
        },
        {
            "id": 56,
            "name": "His Beloved Majesty",
            "cmc": 0,
            "rarity": "M",
            "image": "https://mtgtreachery.net/images/cards/en/trd/056%20-%20Leader%20-%20His%20Beloved%20Majesty.jpg"
        },
        {
            "id": 57,
            "name": "The King over the Scrapyard",
            "cmc": 0,
            "rarity": "R",
            "image": "https://mtgtreachery.net/images/cards/en/trd/057%20-%20Leader%20-%20The%20King%20over%20the%20Scrapyard.jpg"
        },
        {
            "id": 58,
            "name": "The Lich Queen",
            "cmc": 0,
            "rarity": "M",
            "image": "https://mtgtreachery.net/images/cards/en/trd/058%20-%20Leader%20-%20The%20Lich%20Queen.jpg"
        },
        {
            "id": 59,
            "name": "The Old Ruler",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/059%20-%20Leader%20-%20The%20Old%20Ruler.jpg"
        },
        {
            "id": 60,
            "name": "The Queen of Light",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/060%20-%20Leader%20-%20The%20Queen%20of%20Light.jpg"
        },
        {
            "id": 61,
            "name": "The Twin Princesses",
            "cmc": 0,
            "rarity": "R",
            "image": "https://mtgtreachery.net/images/cards/en/trd/061%20-%20Leader%20-%20The%20Twin%20Princesses.jpg"
        },
        {
            "id": 62,
            "name": "The Void Tyrant",
            "cmc": 0,
            "rarity": "U",
            "image": "https://mtgtreachery.net/images/cards/en/trd/062%20-%20Leader%20-%20The%20Void%20Tyrant.jpg"
        }
    ]
}