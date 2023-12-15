import ExtensibleTable from './ExtensibleTable.js';

/**
 * DynamicTable component
 * @ignore
 */
class DynamicTable extends ExtensibleTable {
    /**
     * All predefined lines for this Dynamic Table
     * @type {Array<Object>}
     */
    _predefinedLines = [];

    /**
     * Can players add lines to the table ?
     * @type {boolean}
     */
    _canPlayerAdd = true;

    /**
     * Constructor
     * @param {Object} data Component data
     * @param {string} data.key Component key
     * @param {string|null} [data.tooltip] Component tooltip
     * @param {string} data.templateAddress Component address in template, i.e. component path from entity.system object
     * @param {boolean} [data.head=false] Table head should be bold ?
     * @param {Array<Component>} [data.contents=[]] Container contents
     * @param {Object} [data.rowLayout={}] Dynamic table row layout
     * @param {boolean} [data.deleteWarning=false] Should a warning be triggered on delete
     * @param {Array<Object>} [data.predefinedLines=[]] Dynamic table predefined lines
     * @param {boolean} [data.canPlayerAdd=true] Can players add lines to the table ?
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
        contents = [],
        rowLayout = {},
        deleteWarning = false,
        predefinedLines = [],
        canPlayerAdd = true,
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
            contents: contents,
            cssClass: cssClass,
            head: head,
            rowLayout: rowLayout,
            deleteWarning: deleteWarning,
            role: role,
            permission: permission,
            visibilityFormula: visibilityFormula,
            parent: parent
        });

        this._predefinedLines = predefinedLines;
        this._canPlayerAdd = canPlayerAdd;
    }

    get predefinedLines() {
        return this._predefinedLines;
    }

    get canPlayerAdd() {
        return game.user.isGM || this._canPlayerAdd;
    }

    /**
     * Renders component
     * @override
     * @param {TemplateSystem} entity Rendered entity (actor or item)
     * @param {boolean} [isEditable=true] Is the component editable by the current user ?
     * @return {Promise<JQuery<HTMLElement>>} The jQuery element holding the component
     */
    async _getElement(entity, isEditable = true, options) {
        if (!entity.isTemplate) {
            await this._synchronizePredefinedLines(entity);
        }

        let sampleNewRow = { deleted: false, predefinedIdx: null };

        let baseElement = await super._getElement(entity, isEditable, options);

        let jQElement = $('<table></table>');

        let tableBody = $('<tbody></tbody>');
        let firstRow = $('<tr></tr>');

        for (let component of this._contents) {
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
                sortLeftTabButton.addClass('custom-system-sort-left');
                sortLeftTabButton.attr('title', 'Sort component to the left');

                sortLeftTabButton.on('click', () => {
                    component.sortBeforeInParent(entity);
                });

                cell.append(sortLeftTabButton);
            }

            const colNameSpan = $('<span></span>');
            colNameSpan.append(this._rowLayout[component.key].colName);

            sampleNewRow[component.key] = component?.defaultValue ?? null;

            if (entity.isTemplate) {
                colNameSpan.addClass('custom-system-editable-component');
                colNameSpan.addClass(component.key);
                colNameSpan.append(' {' + component.key + '}');
                colNameSpan.on('click', () => {
                    component.editComponent(entity, this._rowLayout[component.key]);
                });
            }

            cell.append(colNameSpan);

            if (entity.isTemplate) {
                let sortRightTabButton = $('<a><i class="fas fa-caret-right custom-system-clickable"></i></a>');
                sortRightTabButton.addClass('item');
                sortRightTabButton.addClass('custom-system-sort-right');
                sortRightTabButton.attr('title', 'Sort component to the right');

                sortRightTabButton.on('click', () => {
                    component.sortAfterInParent(entity);
                });

                cell.append(sortRightTabButton);
            }

            firstRow.append(cell);
        }

        let headControlsRow = $('<td></td>');

        if (entity.isTemplate) {
            headControlsRow.addClass('custom-system-cell custom-system-cell-alignCenter');
            headControlsRow.append(
                await this.renderTemplateControls(entity, {
                    isDynamicTable: true
                })
            );
        }

        firstRow.append(headControlsRow);
        tableBody.append(firstRow);

        let relevantRows = [];

        if (entity.isTemplate) {
            let predefinedProps = this.predefinedLines;
            for (let rowIndex in predefinedProps) {
                if (predefinedProps.hasOwnProperty(rowIndex) && !predefinedProps[rowIndex].deleted) {
                    relevantRows.push(parseInt(rowIndex));
                }
            }
        } else {
            let dynamicProps = foundry.utils.getProperty(entity.system.props, this.key);
            for (let rowIndex in dynamicProps) {
                if (dynamicProps.hasOwnProperty(rowIndex) && !dynamicProps[rowIndex]?.deleted) {
                    relevantRows.push(parseInt(rowIndex));
                }
            }
        }

        relevantRows = relevantRows.sort(function (a, b) {
            return a - b;
        });

        for (let [index, line] of relevantRows.entries()) {
            let tableRow = $('<tr></tr>');
            tableRow.addClass('custom-system-dynamicRow');

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

                if (entity.isTemplate) {
                    let fieldSpan = $('<span></span>');
                    fieldSpan.addClass(`${this.key}.${line}.${component.key}`);
                    let predefinedField = $('<input />');
                    predefinedField.on('change', () => {
                        this._predefinedLines[line][component.key] = predefinedField.val();
                        this.save(entity);
                    });

                    switch (component.constructor.valueType) {
                        case 'string':
                            predefinedField.prop('type', 'text');
                            predefinedField.prop('value', this.predefinedLines[line][component.key]);
                            break;
                        case 'number':
                            predefinedField.prop('type', 'number');
                            predefinedField.prop('value', this.predefinedLines[line][component.key]);
                            break;
                        case 'boolean':
                            predefinedField.prop('type', 'checkbox');
                            if (this.predefinedLines[line][component.key] === true) {
                                predefinedField.prop('checked', 'checked');
                            }
                            predefinedField.on('change', () => {
                                this._predefinedLines[line][component.key] = predefinedField.is(':checked');
                                this.save(entity);
                            });
                            break;
                        default:
                            predefinedField = $(`<span>${component.constructor.getPrettyName()}</span>`);
                            break;
                    }

                    fieldSpan.append(predefinedField);
                    cell.append(fieldSpan);
                } else {
                    let newCompJson = component.toJSON();
                    newCompJson.key = `${this.key}.${line}.${component.key}`;

                    cell.append(
                        await componentFactory
                            .createComponents(newCompJson)
                            .render(entity, isEditable, { ...options, dynamicRowRef: `${this.key}.${line}` })
                    );
                }

                tableRow.append(cell);
            }

            let controlCell = $('<td></td>');
            let controlDiv = $('<div></div>');
            controlDiv.addClass('custom-system-dynamic-table-row-icons');

            let sortSpan = $('<span></span>');
            sortSpan.addClass('custom-system-dynamic-table-sort-icon-wrapper');

            if (isEditable && line !== relevantRows[0]) {
                let sortUpLink = $(
                    '<a class="custom-system-sortUpDynamicLine custom-system-clickable"><i class="fas fa-sort-up custom-system-dynamic-table-sort-icon"></i></a>'
                );
                sortSpan.append(sortUpLink);

                sortUpLink.on('click', () => {
                    this._swapElements(entity, relevantRows[index - 1], relevantRows[index]);
                });
            }

            if (isEditable && line !== relevantRows[relevantRows.length - 1]) {
                let sortDownLink = $(
                    '<a class="custom-system-sortDownDynamicLine custom-system-clickable"><i class="fas fa-sort-down custom-system-dynamic-table-sort-icon"></i></a>'
                );
                sortSpan.append(sortDownLink);

                sortDownLink.on('click', () => {
                    this._swapElements(entity, relevantRows[index + 1], relevantRows[index]);
                });
            }

            controlDiv.append(sortSpan);

            if (isEditable) {
                let deletionDisabled = false;
                if (!entity.isTemplate) {
                    let predefinedLineIdx = foundry.utils.getProperty(
                        entity.system.props,
                        `${this.key}.${line}.predefinedIdx`
                    );

                    deletionDisabled =
                        predefinedLineIdx !== null
                            ? !!this._predefinedLines[predefinedLineIdx]?.deletionDisabled
                            : false;
                }

                if (!deletionDisabled || game.user.isGM) {
                    let deleteLink = $(
                        '<a class="custom-system-deleteDynamicLine custom-system-clickable"><i class="fas fa-trash"></i></a>'
                    );
                    if (this._deleteWarning) {
                        deleteLink.on('click', () => {
                            Dialog.confirm({
                                title: 'Delete row',
                                content: '<p>Are you sure you want to delete this row ?</p>',
                                yes: () => {
                                    this._deleteRow(entity, line);
                                },
                                no: () => {}
                            });
                        });
                    } else {
                        deleteLink.on('click', () => {
                            this._deleteRow(entity, line);
                        });
                    }
                    controlDiv.append(deleteLink);
                }
            }

            if (entity.isTemplate) {
                let preventDeleteLink = $('<a class="custom-system-clickable"><i class="fas fa-trash-slash"></i></a>');

                if (!this._predefinedLines[line].deletionDisabled) {
                    preventDeleteLink.addClass('custom-system-link-disabled');
                }

                preventDeleteLink.on('click', () => {
                    this._predefinedLines[line].deletionDisabled = !this._predefinedLines[line].deletionDisabled;
                    this.save(entity);
                });

                controlDiv.append(preventDeleteLink);
            }

            controlCell.append(controlDiv);

            tableRow.append(controlCell);
            tableBody.append(tableRow);
        }

        if (isEditable && this.canPlayerAdd) {
            let addRow = $('<tr></tr>');
            let fillCell = $('<td></td>');
            fillCell.attr('colspan', this.contents.length);

            let addButtonCell = $('<td></td>');
            let addButton = $(
                '<a class="custom-system-addDynamicLine custom-system-clickable"><i class="fas fa-plus-circle"></i></a>'
            );
            addButton.on('click', async () => {
                if (entity.isTemplate) {
                    this.predefinedLines.push({
                        ...sampleNewRow,
                        predefinedIdx: this.predefinedLines.length,
                        deletionDisabled: false
                    });
                    await this.save(entity);
                } else {
                    let tableProps = foundry.utils.getProperty(entity.system.props, this.key) ?? {};

                    if (tableProps) {
                        tableProps[Object.keys(tableProps).length] = { ...sampleNewRow };
                    } else {
                        tableProps = {
                            0: { ...sampleNewRow }
                        };
                    }

                    foundry.utils.setProperty(entity.system.props, this.key, tableProps);

                    await entity.entity.update({
                        system: {
                            props: entity.system.props
                        }
                    });
                }
            });

            addButtonCell.append(addButton);

            addRow.append(fillCell);
            addRow.append(addButtonCell);
            tableBody.append(addRow);
        }

        let internalContents = baseElement.hasClass('custom-system-component-contents')
            ? baseElement
            : baseElement.find('.custom-system-component-contents');

        jQElement.append(tableBody);
        internalContents.append(jQElement);
        return baseElement;
    }

    /**
     * Swaps two dynamic table elements
     * @param {TemplateSystem} entity Rendered entity (actor or item)
     * @param {Number} rowIdx1
     * @param {Number} rowIdx2
     * @protected
     * @override
     */
    _swapElements(entity, rowIdx1, rowIdx2) {
        if (entity.isTemplate) {
            let tmpRow = { ...this.predefinedLines[rowIdx1] };
            this._predefinedLines[rowIdx1] = this._predefinedLines[rowIdx2];
            this._predefinedLines[rowIdx2] = tmpRow;

            this.save(entity);
        } else {
            super._swapElements(entity, rowIdx1, rowIdx2);
        }
    }

    /**
     * Deletes a row from the Table
     * @param entity
     * @param rowIdx
     * @protected
     */
    _deleteRow(entity, rowIdx) {
        if (entity.isTemplate) {
            for (let property in this._predefinedLines[rowIdx]) {
                delete this._predefinedLines[rowIdx][property];
            }
            this._predefinedLines[rowIdx].deleted = true;

            this.save(entity);
        } else {
            super._deleteRow(entity, rowIdx);
        }
    }

    /**
     * Synchronizes predefined lines, adding predefined lines to the current line of Dynamic Table
     * @param entity
     * @private
     */
    async _synchronizePredefinedLines(entity) {
        let existingPredefinedIdx = {};
        let dynamicProps = foundry.utils.getProperty(entity.system.props, this.key);

        // Fetching all existing predefined lines in the actor
        for (let line in dynamicProps) {
            if (dynamicProps[line].predefinedIdx !== undefined) {
                existingPredefinedIdx[dynamicProps[line].predefinedIdx] = line;
            }
        }

        for (let predefinedLine of this.predefinedLines) {
            // If line is not deleted or already added to the actor, we add it
            if (predefinedLine.deleted === false) {
                if (!Object.keys(existingPredefinedIdx).includes(String(predefinedLine.predefinedIdx))) {
                    if (dynamicProps) {
                        dynamicProps[Object.keys(dynamicProps).length] = { ...predefinedLine };
                    } else {
                        dynamicProps = {
                            0: { ...predefinedLine }
                        };
                    }
                } else {
                    dynamicProps[existingPredefinedIdx[predefinedLine.predefinedIdx]].deletionDisabled =
                        predefinedLine.deletionDisabled;
                }
            }
        }

        foundry.utils.setProperty(entity.system.props, this.key, dynamicProps);
        await entity.entity.update({
            system: {
                props: entity.system.props
            }
        });
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
            predefinedLines: this.predefinedLines,
            canPlayerAdd: this._canPlayerAdd,
            type: 'dynamicTable'
        };
    }

    /**
     * Creates DynamicTable from JSON description
     * @override
     * @param {Object} json
     * @param {string} templateAddress
     * @param {Container|null} parent
     * @return {DynamicTable}
     */
    static fromJSON(json, templateAddress, parent = null) {
        let rowContents = [];
        let rowLayout = {};

        let dynamicTable = new DynamicTable({
            key: json.key,
            tooltip: json.tooltip,
            templateAddress: templateAddress,
            head: json.head,
            deleteWarning: json.deleteWarning,
            predefinedLines: json.predefinedLines,
            canPlayerAdd: json.canPlayerAdd,
            contents: rowContents,
            rowLayout: rowLayout,
            cssClass: json.cssClass,
            role: json.role,
            permission: json.permission,
            visibilityFormula: json.visibilityFormula,
            parent: parent
        });

        for (let [index, componentDesc] of (json.rowLayout ?? []).entries()) {
            let component = componentFactory.createComponents(
                componentDesc,
                templateAddress + '.rowLayout.' + index,
                dynamicTable
            );
            rowContents.push(component);
            rowLayout[component.key] = {
                align: componentDesc.align,
                colName: componentDesc.colName
            };
        }

        return dynamicTable;
    }

    /**
     * Gets pretty name for this component's type
     * @return {string} The pretty name
     * @throws {Error} If not implemented
     */
    static getPrettyName() {
        return 'Dynamic Table';
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

        existingComponent.canPlayerAdd = existingComponent.canPlayerAdd ?? true;

        mainElt.append(
            await renderTemplate(
                `systems/${game.system.id}/templates/_template/components/dynamicTable.html`,
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

        if (!fieldData.key) {
            throw new Error('Component key is mandatory for ' + this.getPrettyName());
        }

        fieldData.canPlayerAdd = html.find('#tableCanPlayerAdd').is(':checked');

        return fieldData;
    }
}

/**
 * @ignore
 */
export default DynamicTable;
