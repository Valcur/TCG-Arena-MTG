const fs = require('fs');

let lastLoadedCard = "NONE"

function countCost(str) {
    //if (str.length === '') { return 0 }
    const matches = str.match(/\{([^}]+)\}/g);
    if (!matches) return 0;

    return matches.reduce((sum, token) => {
        const content = token.slice(1, -1); // remove { and }
        if (!isNaN(content)) {
            return sum + parseInt(content, 10);
        } else if (content === 'X') {
            return sum + 0;
        } else {
            return sum + 1;
        }
    }, 0);
}

// Fonction pour lire et modifier le fichier JSON
function modifyJsonFile(inputFilePath, outputFilePath, allCardsPath) {
    // Lire le fichier JSON
    fs.readFile(inputFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Erreur lors de la lecture du fichier JSON:', err);
            return;
        }

        fs.readFile(allCardsPath, 'utf8', (err, allData) => {
            if (err) {
                console.error('Erreur lors de la lecture du fichier JSON:', err);
                return;
            }
            let allCardsData = JSON.parse(allData)
            let allCards = {}
            allCardsData.forEach(d => {
                allCards[d.id] = d.oracle_id
            })
            allCardsData = []

            try {
                // Convertir les données JSON en objet
                const jsonObject = JSON.parse(data);
    
    
                let result = {}
                jsonObject.forEach((c) => {
                    lastLoadedCard = c
                    let newCard = {}
    
                    const id = c.oracle_id
                    let image = {}
                    let colors = []
                    if (c.card_faces && c.card_faces[0].image_uris) {
                        image.front = c.card_faces[0].image_uris.normal
                        image.back = c.card_faces[1].image_uris.normal
    
                        colors = c.card_faces[0].colors;
                        c.card_faces[1].colors.forEach((color) => {
                            if (!colors.includes(color)) {
                                colors.push(color)
                            }
                        })
                    } else {
                        image.front = c.image_uris.normal
                        colors = c.colors
                    }
    
                    const getCardType = type_line => {
                        let type = "Other"
                        let lowerCaseTypeLine = type_line.toLowerCase()
                        if (lowerCaseTypeLine.includes("battle")) {
                            type = "Battle"
                        } else if (lowerCaseTypeLine.includes("creature")) {
                            type = "Creature"
                        } else if (lowerCaseTypeLine.includes("land") && !lowerCaseTypeLine.includes("lander")) {
                            // A faire mieux pour le lander
                            type = "Land"
                        } else if (lowerCaseTypeLine.includes("artifact")) {
                            type = "Artifact"
                        } else if (lowerCaseTypeLine.includes("enchantment — aura")) {
                            type = "Enchantment - Aura"
                        } else if (lowerCaseTypeLine.includes("enchantment")) {
                            type = "Enchantment"
                        } else if (lowerCaseTypeLine.includes("instant")) {
                            type = "Instant"
                        } else if (lowerCaseTypeLine.includes("sorcery")) {
                            type = "Sorcery"
                        } else if (lowerCaseTypeLine.includes("planeswalker")) {
                            type = "Planeswalker"
                        } else if (lowerCaseTypeLine.includes("emblem")) {
                            type = "Emblem"
                        } else if (lowerCaseTypeLine.includes("card") 
                            && !c.set_type.includes("memorabilia") 
                            && !c.set_type.includes("minigame") 
                            && !c.name.includes("Checklist") ) {
                            type = "Card"
                        }
                        return type
                    }
    
    
                    let power = 0
                    let toughness = 0
                    if (c.power && !c.power.includes("+") && !c.power.includes("-") && !c.power.includes(".") && !c.power.includes("?") && !c.power.includes("*") && !c.power.includes("∞")) {
                        power = Math.trunc(c.power)
                    }
                    if (c.toughness && !c.toughness.includes("+") && !c.toughness.includes("-") && !c.toughness.includes(".") && !c.toughness.includes("?") && !c.toughness.includes("*") && !c.toughness.includes("∞")) {
                        toughness = Math.trunc(c.toughness)
                    }
    
                    const type = getCardType(c.type_line)
                    newCard = {
                        id: id,
                        name: c.name,
                        type: type,
                        "Card type": c.type_line,
                        face: {
                            front: {
                                name: c.name,
                                type: type,
                                cost: 0,
                                isHorizontal: c.layout == "split" || type == "Battle",
                                image: image.front
                            }
                        },
                        "Colors": colors,
                        "Color identity": c.color_identity,
                        set: c.set,
                        isHorizontal: c.layout == "split" || type == "Battle"
                    }
    
                    if (c.power) {
                        newCard.power = power
                    }
                    if (c.toughness) {
                        newCard.toughness = toughness
                    }
                    if (c.cmc) {
                        newCard.cost = Math.trunc(c.cmc)
                    }
    
                    if (c.card_faces) {
                        let splitType = c.type_line.split(' // ')
                        let splitName = c.name.split(' // ')
    
                        if (splitName.length == 2 && splitType.length == 2) {
                            let typeFront = getCardType(splitType[0])
                            let typeBack = getCardType(splitType[1])
                            newCard.face = {
                                front: {
                                    name: splitName[0],
                                    type: typeFront,
                                    cost: Math.trunc(countCost(c.card_faces[0].mana_cost)),
                                    isHorizontal: typeFront == "Battle",
                                    image: image.front
                                },
                                back: {
                                    name: splitName[1],
                                    type: typeBack,
                                    cost: Math.trunc(countCost(c.card_faces[1].mana_cost)),
                                    isHorizontal: typeBack == "Battle",
                                    image: image.back
                                }
                            }
    
                            if (c.layout == "split" || c.layout == "adventure") {
                                newCard.face = {
                                    front: {
                                        name: c.name,
                                        type: typeFront,
                                        cost: Math.trunc(c.cmc),
                                        isHorizontal: !(c.keywords.includes("Aftermath") || c.layout == "adventure"),
                                        image: image.front
                                    }
                                }
                            }
                        }
                    }
    
                    if (c.type_line.includes("oken") || c.set_type === "token" || type === "Emblem" || type === "Card") {
                        newCard.isToken = true
                    }
    
                    // Tokens ?
                    if (c.all_parts) {
                        let tokens = []
                        c.all_parts.forEach((p) => {
                            if (p.component === "token") {
                                let linkedToken = allCards[p.id]
                                if (linkedToken) {
                                    tokens.push(linkedToken)
                                }
                            }
                        })
                        if (tokens.length > 0) {
                            newCard.tokens = tokens
                        }
                    }
    
                    if (type != "Other" && c.layout != "art_series" && !c.name.includes(" // Wanted!")) {
                        result[id] = newCard
                    }
                })
    
                // Sauvegarder le nouvel objet JSON dans un nouveau fichier
                fs.writeFile(outputFilePath, JSON.stringify(result, null, 2), 'utf8', (err) => {
                    if (err) {
                        console.error('Erreur lors de l\'écriture du fichier JSON:', err);
                    } else {
                        console.log('Le fichier JSON a été modifié et sauvegardé sous', outputFilePath);
                        console.log("Cards total: " + Object.keys(result).length)
                    }
                });
            } catch (e) {
                console.log(lastLoadedCard)
                console.error('Erreur lors du traitement du fichier JSON:', e);
            }
        })
    });
}

// Utilisation de la fonction
const inputFilePath = 'oracle.json';  // Chemin vers le fichier JSON d'entrée
const allCardsPath = 'all.json'
const outputFilePath = 'MTGCards.json';  // Chemin vers le fichier JSON de sortie
modifyJsonFile(inputFilePath, outputFilePath, allCardsPath);