import TemplateSystem from '../../documents/templateSystem.js';
import ExtensibleTable from './ExtensibleTable.js';

/**
 * Class ItemContainer
 * @ignore
 */
class ItemContainer extends ExtensibleTable {
    /**
     * Table header should be displayed
     * @type {boolean}
     * @private
     */
    _headDisplay;

    /**
     * Which templates can be displayed
     * @type {Array<String>}
     * @private
     */
    _templateFilter;

    /**
     * Additional filters to apply on items
     * @type {Array<Object>}
     * @private
     */
    _itemFilter;

    /**
     * Show delete button
     * @type {Boolean}
     * @private
     */
    _showDelete;

    /**
     * Show item status icon
     * @type {Boolean}
     * @private
     */
    _statusIcon;

    /**
     * Alignment of the item reference column
     * @type {String}
     * @private
     */
    _nameAlign;

    /**
     * Label of the item reference column
     * @type {String}
     * @private
     */
    _nameLabel;

    /**
     * ItemContainer constructor
     * @param {Object} data Component data
     * @param {string} data.key Component key
     * @param {string|null} [data.tooltip] Component tooltip
     * @param {string} data.templateAddress Component address in template, i.e. component path from entity.system object
     * @param {string} [data.title=""] Table title
     * @param {boolean} [data.hideEmpty=true] Hide if empty
     * @param {boolean} [data.headDisplay=true] Table header should be displayed
     * @param {boolean} [data.head=false] Table header should be bold
     * @param {boolean} [data.deleteWarning=false] Display warning on item delete
     * @param {boolean} [data.showDelete=true] Display delete button
     * @param {boolean} [data.statusIcon=false] Display item status icon
     * @param {String} [data.nameAlign=null] Alignment of the item reference column
     * @param {String} [data.nameLabel='Name'] Label of the item reference column
     * @param {Array<String>} [data.templateFilter=[]] Which templates can be displayed
     * @param {Array<Object>} [data.itemFilter=[]] Additional filters to apply on items
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
        title = '',
        hideEmpty = true,
        head = false,
        headDisplay = true,
        deleteWarning = false,
        showDelete = true,
        statusIcon = false,
        nameAlign = null,
        nameLabel = 'Name',
        templateFilter = [],
        itemFilter = [],
        contents = [],
        rowLayout = {},
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
            contents: contents,
            rowLayout: rowLayout,
            head: head,
            deleteWarning: deleteWarning,
            role: role,
            permission: permission,
            visibilityFormula: visibilityFormula,
            parent: parent
        });

        this._title = title;
        this._hideEmpty = hideEmpty;
        this._headDisplay = headDisplay;
        this._templateFilter = templateFilter;
        this._itemFilter = itemFilter;
        this._showDelete = showDelete;
        this._statusIcon = statusIcon;
        this._nameAlign = nameAlign;
        this._nameLabel = nameLabel;
    }

    /**
     * Renders component
     * @override
     * @param {TemplateSystem} entity Rendered entity (actor or item)
     * @param {boolean} [isEditable=true] Is the component editable by the current user ?
     * @param {Object} [options={}] Additional options usable by the final Component
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    async _getElement(entity, isEditable = true, options = {}) {
        let jQElement = await super._getElement(entity, isEditable, options);

        let relevantItems = entity.items.filter((item) => {
            let isValid =
                item.type === 'equippableItem' &&
                (this._templateFilter.length === 0 || this._templateFilter.includes(item.system.template));

            if (isValid) {
                for (let filter of this._itemFilter) {
                    switch (filter.operator) {
                        case 'gt':
                            isValid = isValid && item.system.props[filter.prop] > filter.value;
                            break;
                        case 'geq':
                            isValid = isValid && item.system.props[filter.prop] >= filter.value;
                            break;
                        case 'lt':
                            isValid = isValid && item.system.props[filter.prop] < filter.value;
                            break;
                        case 'leq':
                            isValid = isValid && item.system.props[filter.prop] <= filter.value;
                            break;
                        case 'eq':
                        default:
                            isValid = isValid && String(item.system.props[filter.prop]) === filter.value;
                            break;
                    }
                }
            }

            return isValid;
        });

        if (!this._headDisplay && !this._showDelete && this.contents.length === 0 && !entity.isTemplate) {
            jQElement.addClass('flexcol flex-group-no-stretch');

            switch (this._nameAlign) {
                case 'center':
                    jQElement.addClass('flex-group-center');
                    break;
                case 'right':
                    jQElement.addClass('flex-group-right');
                    break;
                case 'left':
                default:
                    jQElement.addClass('flex-group-left');
                    break;
            }

            for (let item of relevantItems) {
                jQElement.append(this._generateItemLink(item));
            }
        } else {
            let tableElement = $('<table></table>');

            if (this._hideEmpty && relevantItems.length == 0 && !entity.isTemplate) {
                tableElement.addClass('hidden');
            }

            if (this._title) {
                let captionElement = $('<caption></caption>');
                captionElement.append(this._title);
                tableElement.append(captionElement);
            }

            let tableBody = $('<tbody></tbody>');

            if (this._headDisplay || entity.isTemplate) {
                let firstRow = $('<tr></tr>');

                if (!this._headDisplay) {
                    firstRow.addClass('custom-system-hidden-row');
                }

                let cell = $('<td></td>');
                cell.addClass('custom-system-cell custom-system-cell-alignCenter');

                if (this._head) {
                    cell.addClass('custom-system-cell-boldTitle');
                }

                switch (this._nameAlign) {
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

                cell.text(this._nameLabel);

                firstRow.append(cell);

                for (let component of this.contents) {
                    let cell = $('<td></td>');
                    cell.addClass('custom-system-cell');

                    switch (this._rowLayout[component.key].align) {
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

                    if (entity.isTemplate) {
                        let sortLeftTabButton = $('<a><i class="fas fa-caret-left custom-system-clickable"></i></a>');
                        sortLeftTabButton.addClass('item');
                        sortLeftTabButton.attr('title', 'Sort component to the left');

                        sortLeftTabButton.on('click', () => {
                            component.sortBeforeInParent(entity);
                        });

                        cell.append(sortLeftTabButton);
                    }

                    const colNameSpan = $('<span></span>');
                    colNameSpan.append(this._rowLayout[component.key].colName);

                    if (entity.isTemplate) {
                        colNameSpan.addClass('custom-system-editable-component');
                        colNameSpan.append(' {' + component.key + '}');
                        colNameSpan.on('click', () => {
                            component.editComponent(entity, this._rowLayout[component.key], ['label']);
                        });
                    }

                    cell.append(colNameSpan);

                    if (entity.isTemplate) {
                        let sortRightTabButton = $('<a><i class="fas fa-caret-right custom-system-clickable"></i></a>');
                        sortRightTabButton.addClass('item');
                        sortRightTabButton.attr('title', 'Sort component to the right');

                        sortRightTabButton.on('click', () => {
                            component.sortAfterInParent(entity);
                        });

                        cell.append(sortRightTabButton);
                    }

                    firstRow.append(cell);
                }

                if (this._showDelete || entity.isTemplate) {
                    let headControlsCell = $('<td></td>');

                    if (entity.isTemplate) {
                        headControlsCell.addClass('custom-system-cell custom-system-cell-alignRight');
                        headControlsCell.append(
                            await this.renderTemplateControls(entity, { allowedComponents: ['label'] })
                        );
                    }

                    firstRow.append(headControlsCell);
                }

                tableBody.append(firstRow);
            }

            for (let item of relevantItems) {
                let tableRow = $('<tr></tr>');
                tableRow.addClass('custom-system-dynamicRow');

                let tableCell = $('<td></td>');
                tableCell.addClass('custom-system-cell');

                switch (this._nameAlign) {
                    case 'center':
                        tableCell.addClass('custom-system-cell-alignCenter');
                        break;
                    case 'right':
                        tableCell.addClass('custom-system-cell-alignRight');
                        break;
                    case 'left':
                    default:
                        tableCell.addClass('custom-system-cell-alignLeft');
                        break;
                }

                tableCell.append(this._generateItemLink(item));

                tableRow.append(tableCell);

                for (let component of this.contents) {
                    let cell = $('<td></td>');
                    cell.addClass('custom-system-cell');

                    switch (this._rowLayout[component.key].align) {
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

                    let newCompJson = component.toJSON();
                    newCompJson.key = '';

                    let itemProps = item.system.props;
                    itemProps.name = item.name;

                    cell.append(
                        await componentFactory.createComponents(newCompJson).render(entity, isEditable, {
                            ...options,
                            customProps: { ...options.customProps, item: itemProps },
                            linkedEntity: item
                        })
                    );

                    tableRow.append(cell);
                }

                if (this._showDelete) {
                    let controlCell = $('<td></td>');
                    let controlDiv = $('<div></div>');
                    controlDiv.addClass('custom-system-dynamic-table-row-icons');

                    if (isEditable) {
                        let deleteLink = $(
                            '<a><i class="fas fa-trash custom-system-deleteDynamicLine custom-system-clickable"></i></a>'
                        );
                        if (this._deleteWarning) {
                            deleteLink.on('click', () => {
                                Dialog.confirm({
                                    title: 'Delete item',
                                    content: '<p>Are you sure you want to delete this item ?</p>',
                                    yes: () => {
                                        entity.entity.deleteEmbeddedDocuments('Item', [item.id]);
                                        entity.render(false);
                                    },
                                    no: () => {}
                                });
                            });
                        } else {
                            deleteLink.on('click', () => {
                                entity.entity.deleteEmbeddedDocuments('Item', [item.id]);
                                entity.render(false);
                            });
                        }
                        controlDiv.append(deleteLink);
                    }
                    controlCell.append(controlDiv);
                    tableRow.append(controlCell);
                }

                tableBody.append(tableRow);
            }

            tableElement.append(tableBody);
            jQElement.append(tableElement);
        }

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
            title: this._title,
            hideEmpty: this._hideEmpty,
            head: this._head,
            headDisplay: this._headDisplay,
            deleteWarning: this._deleteWarning,
            showDelete: this._showDelete,
            statusIcon: this._statusIcon,
            nameAlign: this._nameAlign,
            nameLabel: this._nameLabel,
            templateFilter: this._templateFilter,
            itemFilter: this._itemFilter,
            type: 'itemContainer'
        };
    }

    /**
     * Creates checkbox from JSON description
     * @override
     * @param {Object} json
     * @param {string} templateAddress
     * @param {Container|null} parent
     * @return {ItemContainer}
     */
    static fromJSON(json, templateAddress, parent = null) {
        let rowContents = [];
        let rowLayout = {};

        let itemContainer = new ItemContainer({
            key: json.key,
            tooltip: json.tooltip,
            templateAddress: templateAddress,
            cssClass: json.cssClass,
            title: json.title,
            hideEmpty: json.hideEmpty,
            head: json.head,
            headDisplay: json.headDisplay,
            showDelete: json.showDelete,
            deleteWarning: json.deleteWarning,
            statusIcon: json.statusIcon,
            nameAlign: json.nameAlign,
            nameLabel: json.nameLabel,
            templateFilter: json.templateFilter,
            itemFilter: json.itemFilter,
            contents: rowContents,
            rowLayout: rowLayout,
            role: json.role,
            permission: json.permission,
            visibilityFormula: json.visibilityFormula,
            parent: parent
        });

        for (let [index, componentDesc] of (json.rowLayout ?? []).entries()) {
            let component = componentFactory.createComponents(
                componentDesc,
                templateAddress + '.rowLayout.' + index,
                itemContainer
            );
            rowContents.push(component);
            rowLayout[component.key] = {
                align: componentDesc.align,
                colName: componentDesc.colName
            };
        }

        return itemContainer;
    }

    /**
     * Gets pretty name for this component's type
     * @return {string} The pretty name
     * @throws {Error} If not implemented
     */
    static getPrettyName() {
        return 'Item Container';
    }

    /**
     * Get configuration form for component creation / edition
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    static async getConfigForm(existingComponent) {
        let mainElt = $('<div></div>');

        if (!existingComponent) {
            existingComponent = {};
        }

        if (existingComponent.headDisplay === undefined) {
            existingComponent.headDisplay = true;
        }

        if (existingComponent.showDelete === undefined) {
            existingComponent.showDelete = true;
        }

        if (existingComponent.nameLabel === undefined) {
            existingComponent.nameLabel = 'Name';
        }

        existingComponent.availableTemplates = game.items
            .filter((item) => item.type === '_equippableItemTemplate')
            .map((template) => {
                return {
                    id: template.id,
                    name: template.name,
                    checked: existingComponent.templateFilter
                        ? existingComponent.templateFilter.includes(template.id)
                        : true
                };
            });

        mainElt.append(
            await renderTemplate(
                'systems/' + game.system.id + '/templates/_template/components/itemContainer.html',
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

        fieldData.title = html.find('#itemTitle').val();
        fieldData.hideEmpty = html.find('#itemHideEmpty').is(':checked');
        fieldData.headDisplay = html.find('#itemHeadDisplay').is(':checked');
        fieldData.head = html.find('#itemHead').is(':checked');
        fieldData.showDelete = html.find('#itemShowDelete').is(':checked');
        fieldData.deleteWarning = html.find('#itemDeleteWarning').is(':checked');
        fieldData.statusIcon = html.find('#itemStatusIcon').is(':checked');
        fieldData.nameAlign = html.find('#itemNameAlign').val();
        fieldData.nameLabel = html.find('#itemNameLabel').val();

        fieldData.templateFilter = html
            .find('input[name=itemFilterTemplate]:checked')
            .map(function () {
                return $(this).val();
            })
            .get();

        let itemFilter = [];

        html.find('tr.CSB-itemFilter').each((index, elt) => {
            let prop = $(elt).find('input[name=itemFilterProp]').val();
            let operator = $(elt).find('select[name=itemFilterOp]').val();
            let value = $(elt).find('input[name=itemFilterValue]').val();

            if (!prop) {
                throw new Error('All filters must be based on a property');
            }

            if (!value) {
                throw new Error('All filters must be compared to a value');
            }

            itemFilter.push({
                prop: prop,
                operator: operator,
                value: value
            });
        });

        fieldData.itemFilter = itemFilter;

        return fieldData;
    }

    /**
     * Generates the element to display the item link in the Container
     * @param {CustomItem} item The item to render
     */
    _generateItemLink(item) {
        let itemBox = $('<span></span>');
        let itemLink = $('<a></a>');
        itemLink.addClass('content-link');
        itemLink.attr({
            'data-type': 'Item',
            'data-entity': 'Item',
            'data-id': item.id,
            'data-uuid': item.uuid,
            'data-tooltip': 'Item'
        });
        itemLink.append(`<img src="${item.img}" alt="item image" class="custom-system-item-container-image"/>`);
        itemLink.append(item.name);

        itemLink.on('click', () => {
            item.sheet.render(true);
        });

        if (game.user.isGM && this._statusIcon) {
            let templateLink = $('<i class="fa-solid"></i>');
            templateLink.css({ 'margin-right': '4px' });
            let templateItem = game.items.get(item.system.template);
            if (!templateItem) {
                templateLink.addClass('fa-exclamation-triangle');
                templateLink.css({ color: 'rgba(214, 150, 0, 0.8)' });
            } else {
                templateLink.addClass('fa-circle-check');
                templateLink.css({ color: 'rgba(26, 107, 34, 0.8)', cursor: 'pointer' });
                templateLink.on('click', () => {
                    templateItem.sheet.render(true);
                });
            }

            itemBox.append(templateLink);
        }

        itemBox.append(itemLink);
        return itemBox;
    }
}

/**
 * @ignore
 */
export default ItemContainer;
