import ExtensibleTable from './ExtensibleTable.js';

/**
 * Class ConditionalModifierList
 * @ignore
 */
class ConditionalModifierList extends ExtensibleTable {
    /**
     * Table header should be displayed
     * @type {boolean}
     * @private
     */
    _headDisplay;

    /**
     * Info icon should be displayed
     * @type {boolean}
     * @private
     */
    _infoDisplay;

    /**
     * Label of the selection column
     * @type {String}
     * @private
     */
    _selectionLabel;

    /**
     * Alignment of the selection column
     * @type {String}
     * @private
     */
    _selectionAlign;

    /**
     * Label of the group column
     * @type {String}
     * @private
     */
    _groupLabel;

    /**
     * Alignment of the group column
     * @type {String}
     * @private
     */
    _groupAlign;

    /**
     * Which groups can be displayed
     * @type {Array<String>}
     * @private
     */
    _groupFilter;

    /**
     * Formula defining which groups can be displayed. Overrides _groupFilter
     * @type {String}
     * @private
     */
    _groupFilterFormula;

    /**
     * ConditionalModifierList constructor
     * @param {Object} data Component data
     * @param {string} data.key Component key
     * @param {string|null} [data.tooltip] Component tooltip
     * @param {string} data.templateAddress Component address in template, i.e. component path from entity.system object
     * @param {boolean} [data.headDisplay=true] Table header should be displayed
     * @param {boolean} [data.head=false] Table header should be bold
     * @param {boolean} [data.infoDisplay=false] Info icon with tooltip should be displayed
     * @param {String} [data.selectionLabel='Selected'] Label of the selection column
     * @param {String} [data.selectionAlign=null] Alignment of the selection column
     * @param {String} [data.groupLabel='Group'] Label of the description column
     * @param {String} [data.groupAlign=null] Alignment of the description column
     * @param {Array<String>} [data.groupFilter=[]] Which groups can be displayed
     * @param {String} [data.groupFilterFormula=null] Which groups can be displayed
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
        head = false,
        headDisplay = true,
        infoDisplay = false,
        selectionLabel = 'Selected',
        selectionAlign = null,
        groupLabel = 'Group',
        groupAlign = null,
        groupFilter = [],
        groupFilterFormula = null,
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
            cssClass: cssClass,
            contents: [],
            rowLayout: {},
            head: head,
            deleteWarning: false,
            role: role,
            permission: permission,
            visibilityFormula: visibilityFormula,
            parent: parent
        });

        this._headDisplay = headDisplay;
        this._infoDisplay = infoDisplay;
        this._selectionLabel = selectionLabel;
        this._selectionAlign = selectionAlign;
        this._groupLabel = groupLabel;
        this._groupAlign = groupAlign;
        this._groupFilter = groupFilter;
        this._groupFilterFormula = groupFilterFormula;
    }

    /**
     * Renders component
     * @override
     * @param {TemplateSystem} entity Rendered entity (actor or item)
     * @param {boolean} [isEditable=true] Is the component editable by the current user ?
     * @param {Object} [options={}] Additional options usable by the final Component
     * @param {Object} [options.dynamicRowRef = null] Dynamic Table row reference, passed to the formula computing
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    async _getElement(entity, isEditable = true, options = {}) {
        let { dynamicRowRef = null } = options;

        let jQElement = await super._getElement(entity, isEditable, options);

        let sortedConditionalModifiers = entity.getSortedConditionalModifiers();

        let groupFilter;
        if (this._groupFilterFormula && this._groupFilterFormula !== '') {
            groupFilter = ComputablePhrase.computeMessageStatic(
                `\${${this._groupFilterFormula}}$`,
                entity.system.props,
                {
                    reference: dynamicRowRef,
                    defaultValue: '',
                    triggerEntity: entity
                }
            ).result.split(',');
        } else if (this._groupFilter.length !== 0) {
            groupFilter = this._groupFilter;
        }

        if (groupFilter) {
            sortedConditionalModifiers = Object.keys(sortedConditionalModifiers)
                .filter((key) => groupFilter.includes(key))
                .reduce((obj, key) => {
                    obj[key] = sortedConditionalModifiers[key];
                    return obj;
                }, {});
        }

        let tableElement = $('<table></table>');

        let tableBody = $('<tbody></tbody>');

        if (this._headDisplay || entity.isTemplate) {
            tableBody.append(this._createTemplateColumns());
        }

        for (const [key, group] of Object.entries(sortedConditionalModifiers)) {
            tableBody.append(await this._createRow(key, group, entity));
        }

        tableElement.append(tableBody);
        jQElement.append(tableElement);

        return jQElement;
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
            head: this._head,
            headDisplay: this._headDisplay,
            infoDisplay: this._infoDisplay,
            selectionLabel: this._selectionLabel,
            selectionAlign: this._selectionAlign,
            groupLabel: this._groupLabel,
            groupAlign: this._groupAlign,
            groupFilter: this._groupFilter,
            groupFilterFormula: this._groupFilterFormula,
            type: 'conditionalModifierList'
        };
    }

    /**
     * Creates checkbox from JSON description
     * @override
     * @param {Object} json
     * @param {string} templateAddress
     * @param {Container|null} parent
     * @return {ConditionalModifierList}
     */
    static fromJSON(json, templateAddress, parent = null) {
        return new ConditionalModifierList({
            key: json.key,
            tooltip: json.tooltip,
            templateAddress: templateAddress,
            cssClass: json.cssClass,
            head: json.head,
            headDisplay: json.headDisplay,
            infoDisplay: json.infoDisplay,
            selectionLabel: json.selectionLabel,
            selectionAlign: json.selectionAlign,
            groupLabel: json.groupLabel,
            groupAlign: json.groupAlign,
            groupFilter: json.groupFilter,
            groupFilterFormula: json.groupFilterFormula,
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
        return 'Conditional Modifier List';
    }

    /**
     * Get configuration form for component creation / edition
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    static async getConfigForm(existingComponent, entity) {
        let mainElt = $('<div></div>');

        if (!existingComponent) {
            existingComponent = {};
        }

        if (existingComponent.headDisplay === undefined) {
            existingComponent.headDisplay = true;
        }

        if (existingComponent.head === undefined) {
            existingComponent.head = true;
        }

        if (existingComponent.selectionLabel === undefined) {
            existingComponent.selectionLabel = 'Selected';
        }

        if (existingComponent.groupLabel === undefined) {
            existingComponent.groupLabel = 'Group';
        }

        let availableGroups = ConditionalModifierList._getAvailableGroups(entity);

        existingComponent.availableGroups = availableGroups.map((group) => ({
            group,
            checked: existingComponent.groupFilter ? existingComponent.groupFilter.includes(group) : true
        }));

        mainElt.append(
            await renderTemplate(
                'systems/' + game.system.id + '/templates/_template/components/conditionalModifierList.html',
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

        fieldData.headDisplay = html.find('#modifierHeadDisplay').is(':checked');
        fieldData.head = html.find('#modifierHead').is(':checked');
        fieldData.infoDisplay = html.find('#modifierInfoDisplay').is(':checked');
        fieldData.selectionLabel = html.find('#modifierSelectionLabel').val();
        fieldData.selectionAlign = html.find('#modifierSelectionAlign').val();
        fieldData.groupLabel = html.find('#modifierGroupLabel').val();
        fieldData.groupAlign = html.find('#modifierGroupAlign').val();
        fieldData.groupFilterFormula = html.find('#groupFilterFormula').val();

        fieldData.groupFilter = html
            .find('input[name=groupFilter]:checked')
            .map(function () {
                return $(this).val();
            })
            .get();

        return fieldData;
    }

    /**
     * Creates the header-row of the table
     * @private
     * @returns {jQuery|HTMLElement}
     */
    _createTemplateColumns() {
        let firstRow = $('<tr></tr>');

        for (let i = 0; i < 2; i++) {
            let cell = $('<td></td>');
            cell.addClass('custom-system-cell');

            switch (i === 0 ? this._selectionAlign : this._groupAlign) {
                case 'center':
                    cell.addClass('custom-system-cell-alignCenter');
                    break;
                case 'right':
                    cell.addClass('custom-system-cell-alignRight');
                    break;
                case 'left':
                default:
                    cell.addClass('custom-system-cell-alignLeft');
                    break;
            }

            if (this._head) {
                cell.addClass('custom-system-cell-boldTitle');
            }

            const colNameSpan = $('<span></span>');
            colNameSpan.append(i === 0 ? this._selectionLabel : this._groupLabel);

            cell.append(colNameSpan);

            firstRow.append(cell);
        }

        return firstRow;
    }

    /**
     * Creates a table-row for every conditional modifier
     * @private
     * @param key {String}
     * @param entity
     * @returns {jQuery|HTMLElement}
     */
    async _createRow(key, modifiers, entity) {
        let totalColumns = this._infoDisplay ? 3 : 2;

        let tableRow = $('<tr></tr>');
        tableRow.addClass('custom-system-dynamicRow');

        for (let i = 0; i < totalColumns; i++) {
            let cell = $('<td></td>');
            cell.addClass('custom-system-cell');

            let alignment;
            switch (i) {
                case 0:
                    alignment = this._selectionAlign;
                    cell.append(await this._createIsSelectedCell(key, entity));
                    break;
                case 1:
                    alignment = this._groupAlign;
                    cell.append(this._createDataCell(key));
                    break;
                case 2:
                    alignment = 'right';
                    cell.append(this._createInfoCell(modifiers, entity));
                    break;
                default:
                    alignment = 'left';
                    break;
            }

            switch (alignment) {
                case 'center':
                    cell.addClass('custom-system-cell-alignCenter');
                    break;
                case 'right':
                    cell.addClass('custom-system-cell-alignRight');
                    break;
                case 'left':
                default:
                    cell.addClass('custom-system-cell-alignLeft');
                    break;
            }

            tableRow.append(cell);
        }

        return tableRow;
    }

    /**
     * @private
     * @param key {String}
     * @param entity
     * @returns {jQuery|HTMLElement}
     */
    async _createIsSelectedCell(key, entity) {
        if (entity.system.activeConditionalModifierGroups === undefined) {
            entity.system.activeConditionalModifierGroups = [];
        }

        let input = $('<input type="checkbox"/>');
        input.addClass('custom-system-conditional-modifier');

        input.prop('checked', entity.system.activeConditionalModifierGroups.includes(key) ?? false);

        input.on('click', async () => {
            if (input.is(':checked')) {
                entity.system.activeConditionalModifierGroups.push(key);
            } else {
                entity.system.activeConditionalModifierGroups = entity.system.activeConditionalModifierGroups.filter(
                    (group) => group !== key
                );
            }

            await entity.entity.update({
                system: {
                    activeConditionalModifierGroups: entity.system.activeConditionalModifierGroups
                }
            });
        });

        return input;
    }

    /**
     * @private
     * @param key {String}
     * @returns {jQuery|HTMLElement}
     */
    _createDataCell(key) {
        let data = $('<div></div>');

        data.append(key);

        return data;
    }

    /**
     * @private
     * @param modifiers {Object}
     * @returns {jQuery|HTMLElement}
     */
    _createInfoCell(modifiers, entity) {
        const data = $('<div class="custom-system-dynamic-table-row-icons"></div>');
        const infoIcon = $('<div class="custom-system-tooltip"><i class="fas fa-circle-info"></i></div>');

        const list = $('<ul class="custom-system-tooltip-box"></ul>');
        modifiers.forEach((modifier) => {
            modifier.description = ComputablePhrase.computeMessageStatic(
                modifier.description ?? '',
                modifier.originalEntity.entity.system.props,
                {
                    defaultValue: 0,
                    triggerEntity: modifier.originalEntity
                }
            ).result;

            const tooltipRow = $('<li class="custom-system-tooltip-list-item"></li>');
            tooltipRow.append(modifier.description);

            list.append(tooltipRow);
        });

        infoIcon.append(list);
        data.append(infoIcon);

        return data;
    }

    /**
     * Gets all available conditional modifier groups in all the items plus those set on the active effects of this template
     * @param {TemplateSystem} entity The template to get active effects from
     * @returns {Array<string>}
     */
    static _getAvailableGroups(entity) {
        const availableGroups = new Set();

        game.items
            .map((item) => item.system.modifiers)
            .deepFlatten()
            .filter((modifier) => modifier?.conditionalGroup)
            .forEach((modifier) => {
                availableGroups.add(modifier.conditionalGroup);
            });

        if (entity.system.activeEffects) {
            Object.entries(entity.system.activeEffects).forEach(([effectName, modifiers]) => {
                modifiers
                    .filter((modifier) => modifier?.conditionalGroup)
                    .forEach((modifier) => {
                        availableGroups.add(modifier.conditionalGroup);
                    });
            });
        }

        return Array.from(availableGroups);
    }
}

/**
 * @ignore
 */
export default ConditionalModifierList;
