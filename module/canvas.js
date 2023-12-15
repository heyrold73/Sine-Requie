/**
 * @ignore
 * @override
 */
export const measureDistances = function (segments, options = {}) {
    if (!options.gridSpaces) return BaseGrid.prototype.measureDistances.call(this, segments, options);

    // Track the total number of diagonals
    let nDiagonal = 0;
    const rule = game.settings.get(game.system.id, 'diagonalMovement') ?? 'EQUI';
    const diagonalValue = game.settings.get(game.system.id, 'diagonalMovementCustomVal') ?? 1;

    const d = canvas.dimensions;
    const gridDistance = canvas.scene.grid.distance;

    // Iterate over measured segments
    return segments.map((s) => {
        let r = s.ray;

        // Determine the total distance traveled
        let nx = Math.abs(Math.ceil(r.dx / d.size));
        let ny = Math.abs(Math.ceil(r.dy / d.size));

        // Determine the number of straight and diagonal moves
        let nd = Math.min(nx, ny);
        let ns = Math.abs(ny - nx);
        nDiagonal += nd;

        // Alternative DMG Movement
        if (rule === 'ALT') {
            let nd10 = Math.floor(nDiagonal / 2) - Math.floor((nDiagonal - nd) / 2);
            let spaces = nd10 * 2 + (nd - nd10) + ns;
            return spaces * gridDistance;
        }

        // Euclidean Measurement
        else if (rule === 'EUCL') {
            return Math.round(Math.hypot(nx, ny) * gridDistance);
        }

        // Standard PHB Movement
        else if (rule === 'EQUI') {
            return (ns + nd) * gridDistance;
        } else {
            return ns * gridDistance + nDiagonal * gridDistance * diagonalValue;
        }
    });
};
