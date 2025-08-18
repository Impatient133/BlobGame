// --- HELPER FUNCTIONS (Moved from game.js) ---
function getRadius(mass) {
    return Math.floor(Math.sqrt(Math.max(0, mass) / Math.PI) * 6);
}

// --- BASE CELL CLASS (Moved from game.js) ---
class Cell {
    constructor(x, y, mass, color, name = "") {
        this.x = x;
        this.y = y;
        this.mass = mass;
        this.color = color;
        this.name = name;
        this.radius = getRadius(this.mass);
        this.velocityX = 0;
        this.velocityY = 0;
    }

    updateRadius() {
        this.radius = getRadius(this.mass);
    }

    updatePosition(iceWalls = []) {
        if (this.mass > MIN_MASS_FOR_DECAY) {
            this.mass -= MASS_DECAY_RATE;
            this.updateRadius();
        }

        let nextX = this.x + this.velocityX;
        let nextY = this.y + this.velocityY;

        for (const wall of iceWalls) {
            const closestX = Math.max(wall.x - wall.width / 2, Math.min(nextX, wall.x + wall.width / 2));
            const closestY = Math.max(wall.y - wall.height / 2, Math.min(nextY, wall.y + wall.height / 2));
            const distance = Math.hypot(nextX - closestX, nextY - closestY);

            if (distance < this.radius) {
                const dx = nextX - this.x;
                const dy = nextY - this.y;
                if (Math.abs(dx) > Math.abs(dy)) {
                   this.velocityX = 0;
                } else {
                   this.velocityY = 0;
                }
            }
        }
        
        this.x += this.velocityX;
        this.y += this.velocityY;

        this.velocityX *= FRICTION;
        this.velocityY *= FRICTION;
        this.x = Math.max(this.radius, Math.min(this.x, WORLD_WIDTH - this.radius));
        this.y = Math.max(this.radius, Math.min(this.y, WORLD_HEIGHT - this.radius));
    }

    draw(ctx, camera) {
        const { screenX, screenY } = camera.worldToScreen(this.x, this.y);
        const scaledRadius = this.radius * camera.zoom;

        // Use the canvas context to get screen dimensions, avoiding global dependency
        const SCREEN_WIDTH = ctx.canvas.width;
        const SCREEN_HEIGHT = ctx.canvas.height;

        if (scaledRadius < 2) return;
        if (screenX + scaledRadius < 0 || screenX - scaledRadius > SCREEN_WIDTH ||
            screenY + scaledRadius < 0 || screenY - scaledRadius > SCREEN_HEIGHT) {
            return;
        }

        ctx.beginPath();
        ctx.arc(screenX, screenY, scaledRadius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        if (this.mass > 25 && this.name) {
            const fontSize = Math.floor(scaledRadius / 2.5);
            if (fontSize < 10) return;
            
            ctx.font = `bold ${fontSize}px arial`;
            ctx.fillStyle = FONT_COLOR;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.name, screenX, screenY);
        }
    }
}


// --- CLASS-SPECIFIC GAME SETTINGS ---
const ZOMBIE_BOT_MASS = 25;
const NECROMANCER_COLOR = 'rgb(138, 43, 226)';
const ZOMBIE_COLOR = 'rgb(107, 142, 35)';
const MAGE_COLOR = 'rgb(0, 191, 255)';
const JUGGERNAUT_COLOR = 'rgb(210, 105, 30)';


// --- CLASS-SPECIFIC CELL/OBJECT DEFINITIONS ---

/**
 * ZombieBot Class - A special unit for the Necromancer.
 */
class ZombieBot extends Cell {
    constructor(x, y, owner) {
        super(x, y, ZOMBIE_BOT_MASS, ZOMBIE_COLOR, ""); 
        this.owner = owner;
        this.targetFood = null;
        this.wanderTarget = null;
    }

    updateAi(allCells, food, playerCells, camera) {
        if (playerCells.length === 0) return;

        const allThreats = allCells
            .filter(c => c !== this && c.mass > this.mass * 1.1 && !(c instanceof ZombieBot) && !playerCells.includes(c));

        const ownerCenter = {
            x: playerCells.reduce((sum, c) => sum + c.x, 0) / playerCells.length,
            y: playerCells.reduce((sum, c) => sum + c.y, 0) / playerCells.length
        };
        
        const leashDistance = (window.innerWidth / 2.5) / camera.zoom;
        const distToOwner = Math.hypot(this.x - ownerCenter.x, this.y - ownerCenter.y);

        let targetPos = null;

        const foodInRange = food
            .map(f => ({ cell: f, dist: Math.hypot(this.x - f.x, this.y - f.y) }))
            .filter(f => f.dist < leashDistance);
        
        const safeFood = foodInRange.filter(f => {
            for (const threat of allThreats) {
                if (Math.hypot(f.cell.x - threat.x, f.cell.y - threat.y) < threat.radius + 150) {
                    return false;
                }
            }
            return true;
        });

        this.targetFood = safeFood.length > 0 ? safeFood.reduce((closest, current) => (current.dist < closest.dist ? current : closest)).cell : null;

        if (distToOwner > leashDistance) {
            targetPos = ownerCenter;
        } else if (this.targetFood) {
            targetPos = { x: this.targetFood.x, y: this.targetFood.y };
        } else {
            if (!this.wanderTarget || Math.hypot(this.x - this.wanderTarget.x, this.y - this.wanderTarget.y) < 50) {
                const angle = Math.random() * 2 * Math.PI;
                const radius = Math.random() * leashDistance * 0.8;
                this.wanderTarget = {x: ownerCenter.x + Math.cos(angle) * radius, y: ownerCenter.y + Math.sin(angle) * radius};
            }
            targetPos = this.wanderTarget;
        }

        let seekVector = { x: 0, y: 0 };
        if (targetPos) {
            seekVector.x = targetPos.x - this.x;
            seekVector.y = targetPos.y - this.y;
        }

        let fleeVector = { x: 0, y: 0 };
        const dodgeRange = 250; 
        const threatsInRange = allThreats
            .map(c => ({ cell: c, dist: Math.hypot(this.x - c.x, this.y - c.y) }))
            .filter(c => c.dist < this.radius + c.cell.radius + dodgeRange);

        if (threatsInRange.length > 0) {
            for (const threat of threatsInRange) {
                const awayX = this.x - threat.cell.x;
                const awayY = this.y - threat.cell.y;
                const inverseSquare = 1 / (threat.dist * threat.dist);
                fleeVector.x += awayX * inverseSquare;
                fleeVector.y += awayY * inverseSquare;
            }
        }

        const fleeWeight = 8000;
        this.targetX = this.x + seekVector.x + fleeVector.x * fleeWeight;
        this.targetY = this.y + seekVector.y + fleeVector.y * fleeWeight;

        this.move();
    }

    move() {
        const maxSpeed = Math.max(1.5, 6 - this.mass / 100);
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.hypot(dx, dy);
        let targetVx = 0, targetVy = 0;

        if (distance > 0) {
            targetVx = (dx / distance) * maxSpeed;
            targetVy = (dy / distance) * maxSpeed;
        }
        const lerpFactor = 0.2;
        this.velocityX += (targetVx - this.velocityX) * lerpFactor;
        this.velocityY += (targetVy - this.velocityY) * lerpFactor;
    }

    draw(ctx, camera) {
        const { screenX, screenY } = camera.worldToScreen(this.x, this.y);
        const scaledRadius = this.radius * camera.zoom;
        if (scaledRadius < 2) return;

        ctx.beginPath();
        ctx.arc(screenX, screenY, scaledRadius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        const pulse = 1 + Math.sin(Date.now() * 0.01) * 0.2;
        ctx.beginPath();
        ctx.arc(screenX, screenY, scaledRadius * 0.5 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(138, 43, 226, 0.7)';
        ctx.fill();
    }

    update(iceWalls) {
        this.updatePosition(iceWalls);
    }
}

/**
 * IceWall Class - A special object for the Mage.
 */
class IceWall {
    constructor(x, y, width, height, angle) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.angle = angle;
        this.lifespan = 5 * 60; // 5 seconds
    }

    update() {
        this.lifespan--;
    }

    draw(ctx, camera) {
        ctx.save();
        const { screenX, screenY } = camera.worldToScreen(this.x, this.y);
        
        ctx.translate(screenX, screenY);
        ctx.rotate(this.angle);

        const scaledWidth = this.width * camera.zoom;
        const scaledHeight = this.height * camera.zoom;

        const gradient = ctx.createLinearGradient(-scaledWidth / 2, 0, scaledWidth / 2, 0);
        gradient.addColorStop(0, 'rgba(240, 248, 255, 0.7)');
        gradient.addColorStop(0.5, 'rgba(173, 216, 230, 0.9)');
        gradient.addColorStop(1, 'rgba(240, 248, 255, 0.7)');

        ctx.fillStyle = gradient;
        ctx.globalAlpha = Math.min(1, this.lifespan / 60);
        ctx.fillRect(-scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2 * camera.zoom;
        ctx.strokeRect(-scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);

        ctx.restore();
    }
}


// --- CENTRAL CLASS DEFINITIONS OBJECT ---

const CLASS_DATA = {
    'Necromancer': {
        name: 'Necromancer',
        description: 'Infect enemies to turn them into zombie gatherers. Absorb your zombies to teleport.',
        color: NECROMANCER_COLOR,
        abilities: {
            'possess': {
                name: 'Possess', 
                key_name: '1', 
                cooldown: 5 * 60, 
                desc: 'Absorb the closest zombie to your cursor and reform at its location.',
                execute: function(game) {
                    if (game.abilityCooldowns['possess'] > 0 || game.zombies.length === 0) return;

                    const { worldX, worldY } = game.camera.screenToWorld(game.mousePos.x, game.mousePos.y);
                    
                    const closestZombie = game.zombies.reduce((closest, z) => {
                        const dist = Math.hypot(z.x - worldX, z.y - worldY);
                        return dist < closest.dist ? { zombie: z, dist } : closest;
                    }, { zombie: null, dist: Infinity }).zombie;

                    if (!closestZombie) return;
                    
                    const newPlayerCell = new PlayerCell(closestZombie.x, closestZombie.y, closestZombie.mass, game.playerName, this.color);
                    
                    for (const cell of game.playerCells) {
                        const numChunks = Math.floor(cell.mass / 10) + 1;
                        const massPerChunk = cell.mass / numChunks;
                        for (let i = 0; i < numChunks; i++) {
                            const offsetX = randomInRange(-cell.radius, cell.radius) * 0.5;
                            const offsetY = randomInRange(-cell.radius, cell.radius) * 0.5;
                            const newLiquid = new ReformMass(cell.x + offsetX, cell.y + offsetY, massPerChunk, cell.color, newPlayerCell);
                            game.targetedMass.push(newLiquid);
                        }
                    }

                    game.playerCells = [newPlayerCell];
                    game.zombies = game.zombies.filter(z => z !== closestZombie);
                    game.abilityCooldowns['possess'] = this.abilities.possess.cooldown;
                }
            }
        },
        mechanics: {
            onEat: function(game, eater, eaten) {
                if (eaten instanceof BotCell) {
                    const massToGain = eaten.mass - ZOMBIE_BOT_MASS;
                    if (massToGain > 0) {
                        eater.mass += massToGain;
                        const newZombie = new ZombieBot(eaten.x, eaten.y, eater);
                        game.zombies.push(newZombie);
                        return true; 
                    }
                }
                return false;
            }
        }
    },
    'Mage': {
        name: 'Mage',
        description: 'A powerful sorcerer who can manipulate the battlefield.',
        color: MAGE_COLOR,
        abilities: {
            'ice_wall': {
                name: 'Ice Wall', 
                key_name: '1', 
                cooldown: 10 * 60, 
                desc: 'Create a temporary impassable wall of ice.',
                execute: function(game) {
                    if (game.abilityCooldowns['ice_wall'] > 0 || game.playerCells.length === 0) return;

                    const { worldX, worldY } = game.camera.screenToWorld(game.mousePos.x, game.mousePos.y);
                    const playerCell = game.playerCells[0];
                    
                    const dx = worldX - playerCell.x;
                    const dy = worldY - playerCell.y;
                    const angle = Math.atan2(dy, dx) + Math.PI / 2;

                    const wallLength = window.innerWidth / 3 / game.camera.zoom;
                    const wallThickness = 15 / game.camera.zoom;

                    game.iceWalls.push(new IceWall(worldX, worldY, wallLength, wallThickness, angle));
                    game.abilityCooldowns['ice_wall'] = this.abilities.ice_wall.cooldown;
                }
            },
            'reform': {
                name: 'Reform', 
                key_name: '3', 
                cooldown: 10 * 60, 
                desc: 'Quickly pull your mass to your cursor.',
                execute: function(game) {
                    if (game.abilityCooldowns['reform'] > 0 || game.playerCells.length <= 1) return;

                    const { worldX, worldY } = game.camera.screenToWorld(game.mousePos.x, game.mousePos.y);
                    const targetCell = game.playerCells.reduce((closest, c) => {
                        const dist = Math.hypot(c.x - worldX, c.y - worldY);
                        return dist < closest.dist ? { cell: c, dist } : closest;
                    }, { cell: game.playerCells[0], dist: Infinity }).cell;

                    const cellsToRemove = game.playerCells.filter(cell => cell !== targetCell);
                    
                    for (const cell of cellsToRemove) {
                        const numChunks = Math.floor(cell.mass / 5) + 1;
                        const massPerChunk = cell.mass / numChunks;
                        for (let i = 0; i < numChunks; i++) {
                            const offsetX = randomInRange(-cell.radius, cell.radius) * 0.5;
                            const offsetY = randomInRange(-cell.radius, cell.radius) * 0.5;
                            const newLiquid = new ReformMass(cell.x + offsetX, cell.y + offsetY, massPerChunk, cell.color, targetCell);
                            game.targetedMass.push(newLiquid);
                        }
                    }
                    
                    game.playerCells = [targetCell];
                    game.abilityCooldowns['reform'] = this.abilities.reform.cooldown;
                }
            }
        },
        mechanics: {}
    },
    'Juggernaut': {
        name: 'Juggernaut',
        description: 'An unstoppable force that builds momentum to crush its foes.',
        color: JUGGERNAUT_COLOR,
        // Initialize custom properties when the class is selected
        init: function(game) {
            game.playerState.kineticBuildup = 0;
            game.playerState.lastMoveAngle = null;
            game.playerState.isCharging = false;
            game.playerState.chargeDuration = 0;
        },
        abilities: {
            'unstoppable_charge': {
                name: 'Charge', 
                key_name: '1', 
                cooldown: 15 * 60, 
                desc: 'Become unstoppable and charge forward for 2.5 seconds.',
                execute: function(game) {
                    if (game.abilityCooldowns['unstoppable_charge'] > 0) return;
                    
                    game.playerState.isCharging = true;
                    game.playerState.chargeDuration = 2.5 * 60; // 2.5 seconds
                    game.abilityCooldowns['unstoppable_charge'] = this.abilities.unstoppable_charge.cooldown;
                }
            }
        },
        mechanics: {
            // This runs every frame in the game loop
            onUpdate: function(game) {
                const playerCell = game.playerCells[0];
                if (!playerCell) return;

                // Handle Unstoppable Charge state
                if (game.playerState.isCharging) {
                    if (game.playerState.chargeDuration > 0) {
                        game.playerState.chargeDuration--;
                        // Apply a strong, continuous force
                        const { worldX, worldY } = game.camera.screenToWorld(game.mousePos.x, game.mousePos.y);
                        const dx = worldX - playerCell.x;
                        const dy = worldY - playerCell.y;
                        const distance = Math.hypot(dx, dy);
                        if (distance > 0) {
                            playerCell.velocityX += (dx / distance) * 2;
                            playerCell.velocityY += (dy / distance) * 2;
                        }
                    } else {
                        game.playerState.isCharging = false;
                    }
                }

                // Handle Kinetic Buildup passive
                const currentSpeed = Math.hypot(playerCell.velocityX, playerCell.velocityY);
                if (currentSpeed > 1) { // Only build momentum when moving
                    const currentAngle = Math.atan2(playerCell.velocityY, playerCell.velocityX);
                    if (game.playerState.lastMoveAngle !== null) {
                        const angleDiff = Math.abs(currentAngle - game.playerState.lastMoveAngle);
                        if (angleDiff < 0.2) { // Threshold for "straight" movement
                            game.playerState.kineticBuildup = Math.min(2.5, game.playerState.kineticBuildup + 0.01);
                        } else {
                            game.playerState.kineticBuildup = Math.max(0, game.playerState.kineticBuildup - 0.1);
                        }
                    }
                    game.playerState.lastMoveAngle = currentAngle;
                } else {
                    game.playerState.kineticBuildup = Math.max(0, game.playerState.kineticBuildup - 0.1);
                }

                // Apply the speed boost from kinetic buildup
                playerCell.velocityX += playerCell.velocityX * (game.playerState.kineticBuildup / 10);
                playerCell.velocityY += playerCell.velocityY * (game.playerState.kineticBuildup / 10);
            },
            // Handle unique eating mechanics for the charge
            onEat: function(game, eater, eaten) {
                if (game.playerState.isCharging) {
                    if (eaten.mass < eater.mass * 0.25) { // Instantly absorb small things
                        eater.mass += eaten.mass;
                        return true; // Override default eating
                    }
                }
                return false;
            }
        }
    }
};
