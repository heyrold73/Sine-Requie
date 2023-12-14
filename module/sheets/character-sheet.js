import { CustomActorSheet } from './actor-sheet.js';

/**
 * The character actor sheets
 * @extends {CustomActorSheet}
 * @ignore
 */
export class CharacterSheet extends CustomActorSheet {
    _hasBeenRenderedOnce = false;

    constructor(actor, options) {
        options.resizable = !actor.system.display.fix_size;

        super(actor, options);
    }

    render(force, options = {}) {
        if (!this._hasBeenRenderedOnce) {
            this.position.width = this.actor.system.display.width;
            this.position.height = this.actor.system.display.height;

            this._hasBeenRenderedOnce = true;
        }

        this.options.resizable = !this.actor.system.display.fix_size;

        let data = super.render(force, options);

        return data;
    }
}
