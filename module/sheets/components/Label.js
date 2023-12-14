import InputComponent from './InputComponent.js';
import { postAugmentedChatMessage } from '../../utils.js';

/**
 * Label component
 * @ignore
 */
class Label extends InputComponent {
    static valueType = 'none';

    /**
     * Label icon
     * @type {string|null}
     * @private
     */
    _icon;

    /**
     * Label value
     * @type {string}
     * @private
     */
    _value;

    /**
     * Label prefix
     * @type {string}
     * @private
     */
    _prefix;

    /**
     * Label suffix
     * @type {string}
     * @private
     */
    _suffix;

    /**
     * Label roll message
     * @type {string|null}
     * @private
     */
    _rollMessage;

    /**
     * Label roll message
     * @type {string|null}
     * @private
     */
    _altRollMessage;

    /**
     * Label style
     * @type {string}
     * @private
     */
    _style;

    /**
     * Label constructor
     * @param {Object} data Component data
     * @param {string} data.key Component key
     * @param {string|null} [data.tooltip] Component tooltip
     * @param {string} data.templateAddress Component address in template, i.e. component path from entity.system object
     * @param {string|null} [data.icon=null] Label icon
     * @param {string} [data.value=] Label displayed text
     * @param {string|null} [data.rollMessage=null] Label roll message
     * @param {string|null} [data.altRollMessage=null] Label alternative roll message
     * @param {string} [data.style=label] Field style. Can be title, subtitle, label or bold.
     * @param {string|null} [data.size=null] Field size. Can be full-size, small, medium or large.
     * @param {string|null} [data.cssClass=null] Additional CSS class to apply at render
     * @param {Number} [data.role=0] Component minimum role
     * @param {Number} [data.permission=0] Component minimum permission
     * @param {string|null} [data.visibilityFormula=null] Component visibility formula
     * @param {Container|null} [data.parent=null] Component's container
     */
    constructor({
        key,
        tooltip = null,
        templateAddress,
        icon = null,
        value = '',
        prefix = '',
        suffix = '',
        rollMessage = null,
        altRollMessage = null,
        style = 'label',
        size = null,
        cssClass = null,
        role = 0,
        permission = 0,
        visibilityFormula = null,
        parent = null
    }) {
        super({
            key: key,
            tooltip: tooltip,
            templateAddress: templateAddress,
            label: null,
            defaultValue: null,
            size: size,
            cssClass: cssClass,
            role: role,
            permission: permission,
            visibilityFormula: visibilityFormula,
            parent: parent
        });

        this._icon = icon;
        this._value = value;
        this._prefix = prefix;
        this._suffix = suffix;
        this._rollMessage = rollMessage;
        this._altRollMessage = altRollMessage;
        this._style = style;
    }

    /**
     * Renders component
     * @override
     * @param {TemplateSystem} entity Rendered entity (actor or item)
     * @param {boolean} [isEditable=true] Is the component editable by the current user ?
     * @param {Object} [options={}] Additional options usable by the final Component
     * @param {Object} [options.customProps = {}] Props to merge to the entity props for formula computing
     * @param {Object} [options.linkedEntity = null] Linked entity, passed to the formula computing
     * @param {Object} [options.dynamicRowRef = null] Dynamic Table row reference, passed to the formula computing
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    async _getElement(entity, isEditable = true, options = {}) {
        let { customProps = {}, linkedEntity = null, dynamicRowRef = null } = options;
        let formulaProps = foundry.utils.mergeObject(entity.system?.props ?? {}, customProps, { inplace: false });

        let jQElement;
        switch (this._style) {
            case 'title':
                jQElement = $('<h3></h3>');
                break;
            case 'subtitle':
                jQElement = $('<h4></h4>');
                break;
            case 'bold':
                jQElement = $('<b></b>');
                break;
            case 'button':
                jQElement = $('<button></button>');
                jQElement.attr('type', 'button');
                break;
            case 'label':
            default:
                jQElement = $('<span></span>');
                break;
        }

        let content = '';
        let labelValue = '';

        if (entity.isTemplate) {
            if (this._prefix) {
                content += this._prefix;
            }

            content += this._value === '' ? '&#9744;' : this._value;

            if (this._suffix) {
                content += this._suffix;
            }
        } else {
            if (this._prefix) {
                content += (
                    await ComputablePhrase.computeMessage(this._prefix, formulaProps, {
                        reference: dynamicRowRef,
                        defaultValue: '',
                        triggerEntity: entity,
                        linkedEntity
                    })
                ).result;
            }

            // If Label has a key, it was computed with the derivedData of the entity, no need to recompute it
            if (
                this.key &&
                foundry.utils.getProperty(formulaProps, this.key) !== null &&
                foundry.utils.getProperty(formulaProps, this.key) !== undefined
            ) {
                labelValue = foundry.utils.getProperty(formulaProps, this.key);
                console.debug('Using precomputed value for ' + this.key + ' : ' + content);
            } else {
                try {
                    labelValue = (
                        await ComputablePhrase.computeMessage(this._value, formulaProps, {
                            reference: dynamicRowRef,
                            defaultValue: '',
                            triggerEntity: entity,
                            linkedEntity
                        })
                    ).result;
                } catch (err) {
                    console.error(err);
                    labelValue = 'ERROR';
                }
            }

            content += labelValue;

            if (this._suffix) {
                content += (
                    await ComputablePhrase.computeMessage(this._suffix, formulaProps, {
                        reference: dynamicRowRef,
                        defaultValue: '',
                        triggerEntity: entity,
                        linkedEntity
                    })
                ).result;
            }
        }

        let baseElement = await super._getElement(entity, isEditable, options);
        jQElement.addClass('custom-system-label-root');

        let iconDiv = $('<div></div>');
        iconDiv.addClass('custom-system-label-icons');

        if (this._icon) {
            let iconElement = $('<i></i>');
            iconElement.addClass('custom-system-roll-icon fas fa-' + this._icon);

            iconDiv.append(iconElement);
        }

        jQElement.append(iconDiv);

        let contentDiv = $('<div></div>');

        contentDiv.addClass('custom-system-label');

        if (this._style) {
            contentDiv.addClass('custom-system-label-' + this._style);
        }

        contentDiv.append(content);
        contentDiv.attr('data-value', labelValue);
        contentDiv.attr('data-name', this.key);
        jQElement.append(contentDiv);

        if (isEditable && this._rollMessage) {
            let rollElement = $('<a></a>');
            rollElement.addClass('custom-system-rollable');
            rollElement.append(jQElement);

            let rollIcon = game.settings.get(game.system.id, 'rollIcon');
            if (rollIcon) {
                let rollIconElement = $('<i></i>');
                rollIconElement.addClass('custom-system-roll-icon fas fa-' + rollIcon);
                iconDiv.prepend(rollIconElement);
            }

            if (!entity.isTemplate) {
                let rollProps = foundry.utils.deepClone(formulaProps);

                rollElement.on('click', async (ev) => {
                    let rollMessage;

                    if (ev.shiftKey && this._altRollMessage) {
                        rollMessage = this._altRollMessage;
                    } else {
                        rollMessage = this._rollMessage;
                    }

                    let textContent = new ComputablePhrase(rollMessage);
                    await textContent.compute(rollProps, {
                        reference: dynamicRowRef,
                        computeExplanation: true,
                        triggerEntity: entity,
                        linkedEntity
                    });

                    let speakerData;
                    switch (entity.entityType) {
                        case 'actor':
                            speakerData = ChatMessage.getSpeaker({
                                actor: entity.entity,
                                token: entity.entity?.getActiveTokens()?.[0]?.document ?? null,
                                scene: game.scenes.current
                            });
                            break;
                        case 'item':
                            speakerData = ChatMessage.getSpeaker({
                                actor: entity.entity?.parent,
                                token: entity.entity?.parent?.getActiveTokens()?.[0]?.document ?? null,
                                scene: game.scenes.current
                            });
                            break;
                        default:
                            speakerData = ChatMessage.getSpeaker({});
                    }

                    postAugmentedChatMessage(textContent, {
                        speaker: speakerData
                    });
                });

                if (this.key) {
                    rollElement.on('contextmenu', (ev) => {
                        let contextMenuElement = $('<nav></nav>');
                        contextMenuElement.attr('id', `context-menu`);
                        contextMenuElement.addClass('custom-system-roll-context');

                        let contextActionList = $('<ol></ol>');
                        contextActionList.addClass('context-items');

                        let contextActions = [
                            {
                                name: 'Add as macro',
                                icon: '<i class="fas fa-scroll"></i>',
                                callback: () => {
                                    let rollCode = this.getRollCode(entity);

                                    if (!rollCode) {
                                        return;
                                    }

                                    let chatCommand = '/sheetRoll ' + rollCode;

                                    new Dialog({
                                        title: 'Add macro',
                                        content:
                                            '<div>' +
                                            "<label for='macroName'>Macro Name : </label><input id='macroName' type='text' />" +
                                            '</div>' +
                                            "<p>Macro slot :</p><div style='margin-bottom: 24px'>" +
                                            "<div style='width: 50%;display: inline-block;'>" +
                                            "<label for='macroPage'>Page : </label><input id='macroPage' type='number' />" +
                                            "</div><div style='width: 50%;display: inline-block;'>" +
                                            "<label for='macroSlot'>Slot : </label><input id='macroSlot' type='number' />" +
                                            '</div></div>',
                                        buttons: {
                                            save: {
                                                label: 'Save',
                                                callback: (html) => {
                                                    let macroName = $(html).find('#macroName').val();
                                                    if (macroName === '') {
                                                        throw new Error('Please enter a name');
                                                    }

                                                    let pageNumber = parseInt($(html).find('#macroPage').val()) - 1;
                                                    let slotNumber = parseInt($(html).find('#macroSlot').val());

                                                    if (pageNumber < 0 || pageNumber > 4) {
                                                        throw new Error('Please enter a page number between 1 and 5');
                                                    }

                                                    if (slotNumber < -1 || slotNumber > 9) {
                                                        throw new Error('Please enter a slot number between 0 and 9');
                                                    }

                                                    if (slotNumber === 0) {
                                                        slotNumber = 10;
                                                    }

                                                    let finalSlotNumber = String(pageNumber * 10 + slotNumber);

                                                    Macro.create({
                                                        name: macroName,
                                                        type: CONST.MACRO_TYPES.CHAT,
                                                        user: game.user.id,
                                                        command: chatCommand,
                                                        folder: null
                                                    }).then((newMacro) => {
                                                        game.user.assignHotbarMacro(
                                                            newMacro,
                                                            parseInt(finalSlotNumber)
                                                        );
                                                        newMacro.sheet.render(true);
                                                    });
                                                }
                                            },
                                            cancel: {
                                                label: 'Cancel',
                                                callback: () => {}
                                            }
                                        },
                                        options: {
                                            width: undefined
                                        }
                                    }).render(true);

                                    contextMenuElement.slideUp(200, () => {
                                        contextMenuElement.remove();
                                    });
                                }
                            },
                            {
                                name: 'Copy chat command',
                                icon: '<i class="fas fa-comment"></i>',
                                callback: () => {
                                    let rollCode = this.getRollCode(entity);

                                    if (!rollCode) {
                                        return;
                                    }

                                    let chatCommand = '/sheetRoll ' + rollCode;

                                    navigator.clipboard
                                        .writeText(chatCommand)
                                        .then(() => {
                                            ui.notifications.info(
                                                'Chat command copied in clipboard ! You can now paste it in the chat or use it in a chat macro !'
                                            );
                                        })
                                        .catch(() => {
                                            Dialog.prompt({
                                                title: 'Copy chat command',
                                                content: `<p>Please copy the command in the text box below. You can then paste it in the chat or use it in a chat macro.</p><input type="text" value="${chatCommand}" />`,
                                                label: 'Close',
                                                render: (html) => {
                                                    let input = $(html).find('input');

                                                    input.on('click', () => {
                                                        input.trigger('select');
                                                    });

                                                    input.trigger('click');
                                                },
                                                callback: () => {},
                                                options: {
                                                    width: undefined
                                                }
                                            });
                                        });

                                    contextMenuElement.slideUp(200, () => {
                                        contextMenuElement.remove();
                                    });
                                }
                            },
                            {
                                name: 'Copy macro script',
                                icon: '<i class="fas fa-cogs"></i>',
                                callback: () => {
                                    console.log('Copying script for ' + this.key);

                                    let rollCode = this.getRollCode(entity);

                                    if (!rollCode) {
                                        return;
                                    }

                                    let chatCommand =
                                        'let rollMessage = await actor.roll(\n' +
                                        "    '" +
                                        rollCode +
                                        "',\n" +
                                        '    { postMessage: false}\n' +
                                        ');\n\n' +
                                        'let speakerData = ChatMessage.getSpeaker({\n' +
                                        '    actor: actor,\n' +
                                        '    token: actor.getActiveTokens()?.[0]?.document,\n' +
                                        '    scene: game.scenes.current\n' +
                                        '});\n\n' +
                                        'rollMessage.postMessage({speaker: speakerData});';

                                    navigator.clipboard
                                        .writeText(chatCommand)
                                        .then(() => {
                                            ui.notifications.info(
                                                'Macro script copied in clipboard ! You can now use it in a script macro !'
                                            );
                                        })
                                        .catch(() => {
                                            Dialog.prompt({
                                                title: 'Copy chat command',
                                                content: `<p>Please copy the script in the text box below. You can then use it in a script macro.</p><input type="text" value="${chatCommand}" />`,
                                                label: 'Close',
                                                render: (html) => {
                                                    let input = $(html).find('input');

                                                    input.on('click', () => {
                                                        input.trigger('select');
                                                    });

                                                    input.trigger('click');
                                                },
                                                callback: () => {},
                                                options: {
                                                    width: undefined
                                                }
                                            });
                                        });

                                    contextMenuElement.slideUp(200, () => {
                                        contextMenuElement.remove();
                                    });
                                }
                            }
                        ];

                        if (this._altRollMessage) {
                            contextActions.push(
                                {
                                    name: 'Add alternative as macro',
                                    icon: '<i class="fas fa-scroll"></i>',
                                    callback: () => {
                                        let rollCode = this.getRollCode(entity);

                                        if (!rollCode) {
                                            return;
                                        }

                                        let chatCommand = '/sheetAltRoll ' + rollCode;

                                        new Dialog({
                                            title: 'Add macro',
                                            content:
                                                '<div>' +
                                                "<label for='macroName'>Macro Name : </label><input id='macroName' type='text' />" +
                                                '</div>' +
                                                "<p>Macro slot :</p><div style='margin-bottom: 24px'>" +
                                                "<div style='width: 50%;display: inline-block;'>" +
                                                "<label for='macroPage'>Page : </label><input id='macroPage' type='number' />" +
                                                "</div><div style='width: 50%;display: inline-block;'>" +
                                                "<label for='macroSlot'>Slot : </label><input id='macroSlot' type='number' />" +
                                                '</div></div>',
                                            buttons: {
                                                save: {
                                                    label: 'Save',
                                                    callback: (html) => {
                                                        let macroName = $(html).find('#macroName').val();
                                                        if (macroName === '') {
                                                            throw new Error('Please enter a name');
                                                        }

                                                        let pageNumber = parseInt($(html).find('#macroPage').val()) - 1;
                                                        let slotNumber = parseInt($(html).find('#macroSlot').val());

                                                        if (pageNumber < 0 || pageNumber > 4) {
                                                            throw new Error(
                                                                'Please enter a page number between 1 and 5'
                                                            );
                                                        }

                                                        if (slotNumber < -1 || slotNumber > 9) {
                                                            throw new Error(
                                                                'Please enter a slot number between 0 and 9'
                                                            );
                                                        }

                                                        if (slotNumber === 0) {
                                                            slotNumber = 10;
                                                        }

                                                        let finalSlotNumber = String(pageNumber * 10 + slotNumber);

                                                        Macro.create({
                                                            name: macroName,
                                                            type: CONST.MACRO_TYPES.CHAT,
                                                            user: game.user.id,
                                                            command: chatCommand,
                                                            folder: null
                                                        }).then((newMacro) => {
                                                            game.user.assignHotbarMacro(
                                                                newMacro,
                                                                parseInt(finalSlotNumber)
                                                            );
                                                            newMacro.sheet.render(true);
                                                        });
                                                    }
                                                },
                                                cancel: {
                                                    label: 'Cancel',
                                                    callback: () => {}
                                                }
                                            },
                                            options: {
                                                width: undefined
                                            }
                                        }).render(true);

                                        contextMenuElement.slideUp(200, () => {
                                            contextMenuElement.remove();
                                        });
                                    }
                                },
                                {
                                    name: 'Copy alternative chat command',
                                    icon: '<i class="fas fa-comment"></i>',
                                    callback: () => {
                                        let rollCode = this.getRollCode(entity);

                                        if (!rollCode) {
                                            return;
                                        }

                                        let chatCommand = '/sheetAltRoll ' + rollCode;

                                        navigator.clipboard
                                            .writeText(chatCommand)
                                            .then(() => {
                                                ui.notifications.info(
                                                    'Chat command copied in clipboard ! You can now paste it in the chat or use it in a chat macro !'
                                                );
                                            })
                                            .catch(() => {
                                                Dialog.prompt({
                                                    title: 'Copy chat command',
                                                    content: `<p>Please copy the command in the text box below. You can then paste it in the chat or use it in a chat macro.</p><input type="text" value="${chatCommand}" />`,
                                                    label: 'Close',
                                                    render: (html) => {
                                                        let input = $(html).find('input');

                                                        input.on('click', () => {
                                                            input.trigger('select');
                                                        });

                                                        input.trigger('click');
                                                    },
                                                    callback: () => {},
                                                    options: {
                                                        width: undefined
                                                    }
                                                });
                                            });

                                        contextMenuElement.slideUp(200, () => {
                                            contextMenuElement.remove();
                                        });
                                    }
                                },
                                {
                                    name: 'Copy alternative macro script',
                                    icon: '<i class="fas fa-cogs"></i>',
                                    callback: () => {
                                        console.log('Copying script for ' + this.key);

                                        let rollCode = this.getRollCode(entity);

                                        if (!rollCode) {
                                            return;
                                        }

                                        let chatCommand =
                                            'let rollMessage = await actor.roll(\n' +
                                            "    '" +
                                            rollCode +
                                            "',\n" +
                                            '    { postMessage: false, alternative: true}\n' +
                                            ');\n\n' +
                                            'let speakerData = ChatMessage.getSpeaker({\n' +
                                            '    actor: actor,\n' +
                                            '    token: actor.getActiveTokens()?.[0]?.document,\n' +
                                            '    scene: game.scenes.current\n' +
                                            '});\n\n' +
                                            'rollMessage.postMessage({speaker: speakerData});';

                                        navigator.clipboard
                                            .writeText(chatCommand)
                                            .then(() => {
                                                ui.notifications.info(
                                                    'Macro script copied in clipboard ! You can now use it in a script macro !'
                                                );
                                            })
                                            .catch(() => {
                                                Dialog.prompt({
                                                    title: 'Copy chat command',
                                                    content: `<p>Please copy the script in the text box below. You can then use it in a script macro.</p><input type="text" value="${chatCommand}" />`,
                                                    label: 'Close',
                                                    render: (html) => {
                                                        let input = $(html).find('input');

                                                        input.on('click', () => {
                                                            input.trigger('select');
                                                        });

                                                        input.trigger('click');
                                                    },
                                                    callback: () => {},
                                                    options: {
                                                        width: undefined
                                                    }
                                                });
                                            });

                                        contextMenuElement.slideUp(200, () => {
                                            contextMenuElement.remove();
                                        });
                                    }
                                }
                            );
                        }

                        for (let action of contextActions) {
                            let actionBullet = $('<li></li>');
                            actionBullet.addClass('context-item');
                            actionBullet.html(action.icon + action.name);
                            actionBullet.on('click', action.callback);

                            contextActionList.append(actionBullet);
                        }

                        contextMenuElement.append(contextActionList);
                        $('body').append(contextMenuElement);

                        // Set the position
                        const locationX = ev.pageX;
                        const locationY = ev.pageY;
                        contextMenuElement.css(
                            'left',
                            `${Math.min(locationX, window.innerWidth - (contextMenuElement.width() + 3))}px`
                        );
                        contextMenuElement.css(
                            'top',
                            `${Math.min(locationY + 3, window.innerHeight - (contextMenuElement.height() + 3))}px`
                        );

                        $('body').one('mousedown', (ev) => {
                            if (contextMenuElement.has($(ev.target)).length === 0) {
                                contextMenuElement.slideUp(200, () => {
                                    contextMenuElement.remove();
                                });
                            }
                        });
                    });
                }
            }

            jQElement = rollElement;
        }

        if (entity.isTemplate) {
            jQElement.addClass('custom-system-editable-component');
            jQElement.on('click', () => {
                this.editComponent(entity);
            });
        }

        baseElement.append(jQElement);
        return baseElement;
    }

    getRollCode(entity) {
        let rollCode = this.key;

        if (this.key.includes('.')) {
            let [dynamicTable, rowNum, targetRoll] = this.key.split('.');

            let propRowData = foundry.utils.getProperty(entity.system.props, dynamicTable + '.' + rowNum);

            let rowFilter = null;
            for (let prop in propRowData) {
                if (typeof propRowData[prop] === 'string' && propRowData[prop].length > 0) {
                    rowFilter = `(${prop}=${propRowData[prop]})`;
                    break;
                }
            }

            if (rowFilter) {
                rollCode = dynamicTable + rowFilter + '.' + targetRoll;
            } else {
                ui.notifications.error('Could not create chat command.');
                rollCode = null;
            }
        }

        return rollCode;
    }

    /**
     * Returns serialized component
     * @override
     * @return {Object}
     */
    toJSON() {
        let jsonObj = super.toJSON();

        return {
            ...jsonObj,
            icon: this._icon,
            value: this._value,
            prefix: this._prefix,
            suffix: this._suffix,
            rollMessage: this._rollMessage,
            altRollMessage: this._altRollMessage,
            style: this._style,
            type: 'label'
        };
    }

    /**
     * Creates label from JSON description
     * @override
     * @param {Object} json
     * @param {string} templateAddress
     * @param {Container|null} parent
     * @return {Label}
     */
    static fromJSON(json, templateAddress, parent = null) {
        return new Label({
            key: json.key,
            tooltip: json.tooltip,
            templateAddress: templateAddress,
            icon: json.icon,
            value: json.value,
            prefix: json.prefix,
            suffix: json.suffix,
            rollMessage: json.rollMessage,
            altRollMessage: json.altRollMessage,
            style: json.style,
            size: json.size,
            cssClass: json.cssClass,
            role: json.role,
            permission: json.permission,
            visibilityFormula: json.visibilityFormula,
            parent: parent
        });
    }

    /**
     * Gets pretty name for this component's type
     * @return {string} The pretty name
     * @throws {Error} If not implemented
     */
    static getPrettyName() {
        return 'Label';
    }

    /**
     * Get configuration form for component creation / edition
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    static async getConfigForm(existingComponent) {
        let mainElt = $('<div></div>');

        mainElt.append(
            await renderTemplate(
                `systems/${game.system.id}/templates/_template/components/label.html`,
                existingComponent
            )
        );

        return mainElt;
    }

    /**
     * Extracts configuration from submitted HTML form
     * @override
     * @param {JQuery<HTMLElement>} html The submitted form
     * @return {Object} The JSON representation of the component
     * @throws {Error} If configuration is not correct
     */
    static extractConfig(html) {
        let fieldData = super.extractConfig(html);

        fieldData.style = html.find('#labelStyle').val();
        fieldData.size = html.find('#labelSize').val();
        fieldData.value = html.find('#labelText').val();
        fieldData.prefix = html.find('#labelPrefix').val();
        fieldData.suffix = html.find('#labelSuffix').val();
        fieldData.icon = html.find('#labelIcon').val();
        fieldData.rollMessage = html.find('#labelRollMessage').val();
        fieldData.altRollMessage = html.find('#labelAltRollMessage').val();

        return fieldData;
    }
}

/**
 * @ignore
 */
export default Label;
