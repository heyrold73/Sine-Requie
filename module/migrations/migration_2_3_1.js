import { versionCompare } from '../utils.js';

async function processMigration() {
    let actors = game.actors;
    let items = game.items;

    for (let actor of actors) {
        if (versionCompare(actor.getFlag(game.system.id, 'version'), '2.3.1') < 0) {
            console.log('Processing migration 2.3.1 for ' + actor.name + ' - ' + actor.id);

            actor.setFlag(game.system.id, 'version', '2.3.1');

            if (actor.isTemplate && !actor.system.templateSystemUniqueVersion) {
                await actor.update({
                    system: {
                        templateSystemUniqueVersion: (Math.random() * 0x100000000) >>> 0
                    }
                });
            }
        }
    }

    for (let item of items) {
        if (versionCompare(item.getFlag(game.system.id, 'version'), '2.3.1') < 0) {
            console.log('Processing migration 2.3.1 for ' + item.name + ' - ' + item.id);

            item.setFlag(game.system.id, 'version', '2.3.1');

            if (item.isTemplate && !item.system.templateSystemUniqueVersion) {
                await item.update({
                    system: {
                        templateSystemUniqueVersion: (Math.random() * 0x100000000) >>> 0
                    }
                });
            }
        }
    }
}

export default { processMigration };
