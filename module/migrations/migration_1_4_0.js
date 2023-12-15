import { versionCompare } from '../utils.js';

async function processMigration() {
    let actors = game.actors;

    for (let actor of actors) {
        if (versionCompare(actor.getFlag(game.system.id, 'version'), '1.4.0') < 0) {
            console.log('Processing migration 1.4.0 for ' + actor.name + ' - ' + actor.id);

            let system = actor.system;

            let newContents = [];

            if (system.display.header_below) {
                for (let component of system.header.contents) {
                    newContents.push(component);
                }

                system.header.contents = [];
            }

            if (system.tabs) {
                newContents.push({
                    type: 'tabbedPanel',
                    key: '',
                    cssClass: '',
                    contents: system.tabs
                });

                system.tabs = null;
            }

            system.body.contents = newContents;

            actor.setFlag(game.system.id, 'version', '1.4.0');

            await actor.update({
                system: {
                    header: actor.system.header,
                    body: actor.system.body,
                    '-=tabs': null,
                    display: { '-=header_below': null }
                }
            });

            console.log('\tFinished migration 1.4.0 for ' + actor.name + ' - ' + actor.id);
        }
    }
}

export default { processMigration };
