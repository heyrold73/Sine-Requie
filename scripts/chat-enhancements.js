// Displays roll explanation in a floating div
async function expandMfsRoll(ev) {
    // Get clicked roll
    const target = ev.currentTarget;
    const data = $(target).data('roll-data');

    if (data) {
        data.arrayExplanation = [];

        // Adding roll results to the explanation
        for (let roll of data.rolls) {
            let rollObject = Roll.fromJSON(JSON.stringify(roll.roll));
            let htmlTooltip = $(await rollObject.getTooltip());
            let diceIcons = htmlTooltip.find('.dice-rolls li');

            let spanIcons = [];
            for (let icon of diceIcons) {
                let span = $('<span>');
                span.addClass($(icon).attr('class'));
                span.addClass('custom-system-roll-tooltip-dice');
                span.text($(icon).text());

                spanIcons.push(span.prop('outerHTML'));
            }

            data.arrayExplanation.push({
                name: roll.formula,
                value: roll.roll.total,
                dice: spanIcons.join('')
            });
        }

        function getFormattedExplanation(node, branch = '') {
            const isGraphHead = branch.length === 0;
            const children = node.children || [];

            if (node.display) {
                let correctedToken = node.display;
                let specialCharCodes = correctedToken.matchAll(/\u037E([0-9]+)\u037E/g);
                let charCode = specialCharCodes.next();

                while (!charCode.done) {
                    let charCodeNumber = Number(charCode.value[1]);
                    correctedToken = correctedToken.replace(
                        '\u037E' + charCodeNumber + '\u037E',
                        String.fromCodePoint(charCodeNumber)
                    );

                    charCode = specialCharCodes.next();
                }

                let branchHead = '';

                if (!isGraphHead) {
                    branchHead = children && children.length !== 0 ? '┬&nbsp;' : '─&nbsp;';
                }

                let offset = branch + branchHead;

                data.arrayExplanation.push({
                    name: correctedToken,
                    value: node.value,
                    offset:
                        '<span style="font-family: monospace">' +
                        (offset.length > 0 ? '&nbsp;' : '') +
                        offset +
                        '</span>'
                });
            }

            let baseBranch = branch;

            if (!isGraphHead) {
                const isChildOfLastBranch = branch.slice(-2) === '└─';
                baseBranch = branch.slice(0, -2) + (isChildOfLastBranch ? '&nbsp;&nbsp;' : '│&nbsp;');
            }

            const nextBranch = baseBranch + '├─';
            const lastBranch = baseBranch + '└─';

            children.forEach((child, index) => {
                getFormattedExplanation(child, children.length - 1 === index ? lastBranch : nextBranch);
            });
        }

        for (let node of Array.from(data.tokens.children)) {
            getFormattedExplanation(node);
        }

        // Get message element
        const message = $(target).parents('.message-content');

        if (data) {
            const template_file = `systems/${game.system.id}/templates/chat/chat-roll-tooltip.html`;

            // Render explanation template
            renderTemplate(template_file, data).then((html) => {
                // Add last-minute CSS
                const tooltipWrapper = $(html)[0];
                const tooltip = tooltipWrapper.children[0];

                tooltip.style.width = `max-content`;
                tooltip.style['min-width'] = `280px`;
                tooltip.style['max-width'] = `800px`;

                // Append the explanation to the message (Adding to DOM)
                message.append($(tooltipWrapper));

                // Set the position
                const pa = target.getBoundingClientRect();
                const pt = tooltip.getBoundingClientRect();
                tooltip.style.left = `${Math.min(pa.x, window.innerWidth - (pt.width + 3))}px`;
                tooltip.style.top = `${Math.min(pa.y + pa.height + 3, window.innerHeight - (pt.height + 3))}px`;
                const zi = getComputedStyle(target).zIndex;
                tooltip.style.zIndex = Number.isNumeric(zi) ? zi + 1 : 100;

                // Adding a handler to remove explanation on click anywhere on the page
                $(document).one('click', () => {
                    $(tooltipWrapper).remove();
                });
            });
        }
    }
}

/**
 * Hides roll data if needed by current roll mode
 * @param roll The roll element
 */
const hideRollData = (roll) => {
    roll.data('roll-data', null);
    roll.find('span').text('?');
};

$(() => {
    // Adding the handler on every roll in the page, now and future
    $(document).on('click', '.custom-system-roll', expandMfsRoll);
});

// When rendering a chat message, applying roll mode
Hooks.on('renderChatMessage', (message, elt) => {
    let rolls = $(elt).find('.custom-system-roll');
    for (let rollElt of rolls) {
        let roll = $(rollElt);
        let rollMode = roll.data('roll-mode');

        if (rollMode === CONST.DICE_ROLL_MODES.PRIVATE && !game.user.isGM && !message.isAuthor) {
            hideRollData(roll);
        } else if (rollMode === CONST.DICE_ROLL_MODES.BLIND && !game.user.isGM) {
            hideRollData(roll);
        } else if (rollMode === CONST.DICE_ROLL_MODES.SELF && !message.isAuthor) {
            hideRollData(roll);
        }

        if (roll.data('hidden')) {
            roll.addClass('custom-system-hidden-roll');

            if (!(game.user.isGM && game.settings.get(game.system.id, 'showHiddenRoll'))) {
                roll.hide();
            }
        }
    }
});

Hooks.on('preCreateChatMessage', (document, data, options, userId) => {
    data.content = String(data.content) ?? '';
    // Handling actor references. They are @{<actor_name OR selected OR target>|<prop>}
    let messageReferences = data.content.matchAll(/@{(.*?)\|(.*?)}/g);
    let reference = messageReferences.next();

    while (!reference.done) {
        let [fullRef, actorName, refProp] = reference.value;

        let actor = null;

        // Recovering the right actor
        if (actorName === 'selected') {
            actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
        } else if (actorName === 'target') {
            actor = game.user.targets.values().next().value?.actor;
        } else {
            actor = game.actors.filter((e) => e.name === actorName)[0];
        }

        // If actor was found
        if (actor && actor.testUserPermission(game.user, CONST.DOCUMENT_PERMISSION_LEVELS.LIMITED)) {
            let refPropSplitted = refProp.split('.');
            let [filterMatch, parentProp, filterProp, filterValue] =
                refPropSplitted.shift().match(/^([a-zA-Z0-9_]+)\(([a-zA-Z0-9_]+)=(.+)\)$/) ?? [];

            if (filterMatch) {
                let parent = foundry.utils.getProperty(actor.getRollData(), parentProp);

                let index = Object.keys(parent).filter((key) => parent[key][filterProp] === filterValue)[0];

                refProp = parentProp + '.' + index + '.' + refPropSplitted.join('.');
            }

            // Recovering value from data
            let value = foundry.utils.getProperty(actor.getRollData(), refProp);

            if (value) {
                document.content = document.content.replace(fullRef, () => value);
            }
        }

        reference = messageReferences.next();
    }

    if (document.content !== data.content) {
        document.updateSource({
            content: document.content
        });
    }
});

const objectToDotNotation = (obj, prefix = '') => {
    let res = {};

    for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
            if (Array.isArray(obj[key])) {
                res[prefix + key] = '[' + obj[key].join(', ') + ']';
            } else if (typeof obj[key] === 'object') {
                res = {
                    ...res,
                    ...objectToDotNotation(obj[key], prefix + key + '.')
                };
            } else {
                res[prefix + key] = obj[key];
            }
        }
    }

    return res;
};
