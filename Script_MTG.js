const fs = require('fs');

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

const setCustomLegality = (card, value) => {
    formats.forEach(f => {
        card._legal[f.code] = card._legal[f.code] === true ? value : false
    })
}

const handleLegalityOveride = (newCard, oracle_id) => {
    // Legality override
    if ([
        "47e191f7-6314-4875-b5ee-57e5daf089c4", // Dragon's approach
        "3c1619bd-db5e-4df6-a196-0a9d62374f6d", // Hare apparent
        "0e488c6c-aae2-450f-b969-7bb5a1b37a66", // Persistent petioner
        "ec77d23b-0165-450d-9aae-73b755163753", // Rat colony
        "595a15f0-77f3-4544-8acc-10630e12cc14", // Shadowborn apostle
        "b53597f4-1a0f-4fa8-9c17-29178cdc4d2b", // Slime against humanity
        "7423b3b9-56eb-4cf2-8ada-135918219c4b", // Tempest hawk
        "f9453fe2-fadf-4cd4-8d2c-0eaa0e2d78d6" // Templar knigh
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
    fs.readFile(inputFilePath, 'utf8', (err, data) => {
        if (err) return console.error('Erreur lecture input JSON:', err);

        fs.readFile(allCardsPath, 'utf8', (err, allData) => {
            if (err) return console.error('Erreur lecture allCards JSON:', err);

            const allCards = {};
            JSON.parse(allData).forEach(d => allCards[d.id] = d.oracle_id);

            try {
                const jsonObject = JSON.parse(data);
                const result = {};

                jsonObject.forEach(c => {
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
                        setCustomLegality(newCard, true)
                    }

                    // Tokens liés
                    if (c.all_parts) {
                        const tokens = c.all_parts
                            .filter(p => (p.component === "token" || p.type_line === "Dungeon") && allCards[p.id])
                            .map(p => allCards[p.id]);
                        if (tokens.length) newCard.tokens = tokens;
                    }

                    if (type != "Other" && c.layout != "art_series" && !c.name.includes(" // Wanted!")) {
                        result[c.oracle_id] = newCard;
                    } else if (c.type_line === "Dungeon") {
                        result[c.oracle_id] = newCard;
                    }
                });

                fs.writeFile(outputFilePath, JSON.stringify(result, null, 2), 'utf8', (err) => {
                    if (err) console.error('Erreur écriture output JSON:', err);
                    else {
                        console.log(`Fichier sauvegardé: ${outputFilePath}, total cartes: ${Object.keys(result).length}`);
                        increaseGameVersion()
                    }
                });
            } catch (e) {
                console.log(lastLoadedCard);
                console.error('Erreur traitement JSON:', e);
            }
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
