// --- Setup Canvas ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// --- Constants ---
const SCREEN_WIDTH = canvas.width;
const SCREEN_HEIGHT = canvas.height;
const WORLD_WIDTH = 2500;
const WORLD_HEIGHT = 2500;

// Colors
const WHITE = 'rgb(255, 255, 255)';
const BLACK = 'rgb(0, 0, 0)';
const GRID_COLOR = 'rgb(230, 230, 230)';
const FONT_COLOR = 'rgb(50, 50, 50)';
const DEATH_MESSAGE_COLOR = 'rgb(200, 30, 30)';
const FOOD_COLORS = [
    'rgb(255, 0, 255)', 'rgb(0, 255, 255)', 'rgb(0, 255, 0)', 'rgb(255, 165, 0)', 'rgb(255, 255, 0)'
];
const FEED_CHEAT_COLOR = 'rgb(255, 105, 180)';
const WEB_COLOR = 'rgb(148, 0, 211)';
const PURGE_COLOR = 'rgb(0, 255, 100)';
const CREEP_COLOR = 'rgba(128, 0, 128, 0.39)';
const UI_GRAY = 'rgb(80, 80, 80)';
const UI_GREEN = 'rgb(0, 200, 0)';
const UI_RED = 'rgb(200, 0, 0)';
const UI_GOLD = 'rgb(255, 215, 0)';


// --- Game Settings ---
const INITIAL_PLAYER_MASS = 20;
const INITIAL_BOT_MASS = 15;
const EMPLOYEE_BOT_MASS = 15;
const FOOD_MASS = 2;
const FOOD_COUNT = 300;
const INITIAL_BOT_COUNT = 15;
const MAX_BOT_COUNT = 50;
const MIN_MASS_TO_SPLIT = 40;
const MIN_MASS_TO_EJECT = 30;
const EJECTED_MASS_AMOUNT = 10;
const FRICTION = 0.98;

// --- Mass Decay Settings ---
const MASS_DECAY_RATE = 0.005;
const MIN_MASS_FOR_DECAY = 100;

// --- Dynamic Timers & Split Mechanics ---
const BASE_MERGE_TIME = 15 * 60;
const MASS_MERGE_TIME_FACTOR = 0.5;
const COLLISION_COOLDOWN_TIME = 1 * 60;
const SPLIT_VELOCITY = 40;
const EJECT_VELOCITY = 12;
const EJECT_COOLDOWN_TIME = 5;

// --- Feed Cheat Settings ---
const FEED_CHEAT_DRAIN_RATE = 2.0;
const FEED_CHEAT_PERCENT_DRAIN = 0.002;
const BASE_FEED_CHEAT_CHUNK_MASS = 2;
const FEED_CHEAT_MASS_SCALE_PERCENT = 0.01;
const FOOD_CHEAT_SPAWN_RATE = 15; // How often food spawns with cheat (in frames)

// --- Web Shot & Creep Settings ---
const WEB_SHOT_COST = 20;
const WEB_SHOT_SPEED = 25;
const TENDRIL_GROWTH_SPEED = 1.0;
const BASE_TENDRIL_LENGTH = 150;
const TENDRIL_LENGTH_MASS_FACTOR = 0.7;
const TENDRIL_WAVE_SPEED = 0.03;
const TENDRIL_WAVE_AMPLITUDE = 0.8;
const TENDRIL_SPAWN_RATE = 90;
const CREEP_FOOD_SPAWN_RATE = 60;
const CREEP_GROWTH_RATE = 0.15;
const MAX_CREEP_RADIUS_BASE = 80;
const CREEP_RADIUS_MASS_FACTOR = 0.5;

// --- Bot Spawning Settings ---
const NORMAL_SPAWN_RATE = 90;

// --- Ability System Settings ---
const ABILITY_STATS = {
    'parasite_shot': {
        'name': 'Parasite Shot', 'key_name': '1', 'costs': [150, 750, 1250],
        'description': 'Fire a projectile that infects a bot, causing it to spread to others.',
        'tiers': [
            {'desc': 'Infect up to 3 bots, 1 tentacle per bot.', 'cooldown': 10 * 60, 'max_tendrils': 1, 'max_spread': 3},
            {'desc': 'Infect up to 6 bots, 2 tentacles per bot.', 'cooldown': 10 * 60, 'max_tendrils': 2, 'max_spread': 6},
            {'desc': 'Infect up to 15 bots, 3 tentacles per bot.', 'cooldown': 10 * 60, 'max_tendrils': 3, 'max_spread': 15},
        ]
    },
    'gatherer': {
        'name': 'Gatherer', 'key_name': '2', 'costs': [150, 750, 1250],
        'description': 'Spend mass to spawn an employee bot that gathers food for you.',
        'tiers': [
            {'desc': 'Max 3 employees. Cost: 100 mass.', 'cost': 100, 'max_employees': 3, 'max_trips': 2, 'capacity': 25, 'cooldown': 2 * 60},
            {'desc': 'Max 6 employees. Cost: 100 mass.', 'cost': 100, 'max_employees': 6, 'max_trips': 4, 'capacity': 35, 'cooldown': 2 * 60},
            {'desc': 'Max 10 employees. Cost: 100 mass.', 'cost': 100, 'max_employees': 10, 'max_trips': 6, 'capacity': 50, 'cooldown': 2 * 60},
        ]
    },
    'regroup': {
        'name': 'Regroup Mass', 'key_name': '3', 'costs': [150, 750, 1250],
        'description': 'Rapidly pull all of your mass into a single cell.',
        'tiers': [
            {'desc': '15 second cooldown.', 'cooldown': 15 * 60},
            {'desc': '5 second cooldown.', 'cooldown': 5 * 60},
            {'desc': 'No cooldown.', 'cooldown': 0},
        ]
    },
    'mass_purge': {
        'name': 'Mass Purge', 'key_name': '4', 'costs': [150, 750, 1250],
        'description': 'Unleash a viral purge that decays a percentage of all cells on the map.',
        'tiers': [
            {'desc': 'Purge affects 20% of cells.', 'cost': 150, 'duration': 5*60, 'affect_percentage': 0.2, 'decay_rate': 0.01},
            {'desc': 'Purge affects 35% of cells.', 'cost': 150, 'duration': 5*60, 'affect_percentage': 0.35, 'decay_rate': 0.01},
            {'desc': 'Purge affects 50% of cells.', 'cost': 150, 'duration': 5*60, 'affect_percentage': 0.5, 'decay_rate': 0.015},
        ]
    }
};

// --- Helper Functions ---
function getRadius(mass) {
    return Math.floor(Math.sqrt(Math.max(0, mass) / Math.PI) * 6);
}

function getRandomColor() {
    const r = Math.floor(Math.random() * 151) + 50;
    const g = Math.floor(Math.random() * 151) + 50;
    const b = Math.floor(Math.random() * 151) + 50;
    return `rgb(${r}, ${g}, ${b})`;
}

function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
}

function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

// --- Classes ---

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
        this.isPurged = false;
        this.purgeTimer = 0;
        this.purgeDecayRate = 0;
    }

    updateRadius() {
        this.radius = getRadius(this.mass);
    }

    updatePosition() {
        if (this.mass > MIN_MASS_FOR_DECAY) {
            this.mass -= MASS_DECAY_RATE;
            this.updateRadius();
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

class PlayerCell extends Cell {
    constructor(x, y, mass, name, color = null) {
        super(x, y, mass, color || getRandomColor(), name);
        this.mergeTimer = 0;
        this.collisionCooldown = 0;
    }

    setMovementInput(mousePos, camera) {
        const maxSpeed = Math.max(1.5, 6 - this.mass / 100);
        const { worldX, worldY } = camera.screenToWorld(mousePos.x, mousePos.y);
        const dx = worldX - this.x;
        const dy = worldY - this.y;
        const distance = Math.hypot(dx, dy);
        let targetVx = 0, targetVy = 0;

        if (distance > this.radius * 0.8 && distance > 0) {
            targetVx = (dx / distance) * maxSpeed;
            targetVy = (dy / distance) * maxSpeed;
        }

        const lerpFactor = 0.1;
        this.velocityX += (targetVx - this.velocityX) * lerpFactor;
        this.velocityY += (targetVy - this.velocityY) * lerpFactor;
    }

    update() {
        if (this.mergeTimer > 0) this.mergeTimer--;
        if (this.collisionCooldown > 0) this.collisionCooldown--;
        this.updatePosition();
    }
}

class BotCell extends Cell {
    constructor(x, y, mass) {
        super(x, y, mass, getRandomColor(), `Bot${Math.floor(Math.random() * 100) + 1}`);
        this.targetX = Math.random() * WORLD_WIDTH;
        this.targetY = Math.random() * WORLD_HEIGHT;
        this.isWebbed = false;
        this.tendrilSpawnTimer = TENDRIL_SPAWN_RATE;
        this.creepRadius = 0;
        this.creepShapeOffsets = [];
        this.creepAnimOffset = Math.random() * 2 * Math.PI;
        this.creepIsPainted = false;
        
        const personalities = ["timid", "aggressive", "opportunist"];
        this.personality = personalities[Math.floor(Math.random() * personalities.length)];
        this.huntingTarget = null;
    }

    updateAi(allCells, food, playerCells, camera) {
        if (this.isWebbed) {
            this.velocityX = 0;
            this.velocityY = 0;
            return;
        }

        const visionRange = (SCREEN_WIDTH / 2) / camera.zoom;

        if (this.personality === "aggressive" && this.huntingTarget) {
            if (!allCells.includes(this.huntingTarget) || this.mass < this.huntingTarget.mass * 0.9) {
                this.huntingTarget = null;
            } else {
                this.targetX = this.huntingTarget.x;
                this.targetY = this.huntingTarget.y;
                this.move();
                return;
            }
        }
        
        switch (this.personality) {
            case "timid": this.runTimidAi(allCells, food, visionRange); break;
            case "aggressive": this.runAggressiveAi(allCells, food, playerCells, visionRange); break;
            case "opportunist": this.runOpportunistAi(allCells, food, playerCells, visionRange); break;
        }
        
        this.move();
    }

    getClosest(targets, property = 'dist') {
        if (!targets || targets.length === 0) return null;
        return targets.reduce((closest, current) => (current[property] < closest[property] ? current : closest), targets[0]);
    }
    
    runTimidAi(allCells, food, visionRange) {
        const threats = allCells
            .filter(c => c !== this && c.mass > this.mass * 1.1)
            .map(c => ({ cell: c, dist: Math.hypot(this.x - c.x, this.y - c.y) }))
            .filter(c => c.dist < visionRange);

        if (threats.length > 0) {
            const closestThreat = this.getClosest(threats).cell;
            this.targetX = this.x + (this.x - closestThreat.x);
            this.targetY = this.y + (this.y - closestThreat.y);
            return;
        }

        if (food.length > 0) {
            const foodWithDist = food.map(f => ({ cell: f, dist: Math.hypot(this.x - f.x, this.y - f.y) }));
            const closestFood = this.getClosest(foodWithDist).cell;
            this.targetX = closestFood.x;
            this.targetY = closestFood.y;
        } else {
            this.wander();
        }
    }
    
    runAggressiveAi(allCells, food, playerCells, visionRange) {
        const potentialTargets = playerCells
            .filter(p => this.mass > p.mass * 1.1)
            .map(p => ({ cell: p, dist: Math.hypot(this.x - p.x, this.y - p.y) }))
            .filter(p => p.dist < visionRange);

        const prey = allCells
            .filter(c => c !== this && this.mass > c.mass * 1.1)
            .map(c => ({ cell: c, dist: Math.hypot(this.x - c.x, this.y - c.y) }))
            .filter(c => c.dist < visionRange);
            
        const allPrey = potentialTargets.concat(prey);
        if (allPrey.length > 0) {
            const closestPrey = this.getClosest(allPrey, 'dist').cell;
            this.huntingTarget = closestPrey;
            this.targetX = closestPrey.x;
            this.targetY = closestPrey.y;
            return;
        }

        const threats = allCells
            .filter(c => c !== this && c.mass > this.mass * 2.5)
            .map(c => ({ cell: c, dist: Math.hypot(this.x - c.x, this.y - c.y) }))
            .filter(c => c.dist < visionRange);

        if (threats.length > 0) {
            const closestThreat = this.getClosest(threats).cell;
            this.targetX = this.x + (this.x - closestThreat.x);
            this.targetY = this.y + (this.y - closestThreat.y);
            return;
        }
        
        this.wander();
    }

    runOpportunistAi(allCells, food, playerCells, visionRange) {
        const threats = allCells
            .filter(c => c !== this && c.mass > this.mass * 1.5)
            .map(c => ({ cell: c, dist: Math.hypot(this.x - c.x, this.y - c.y) }))
            .filter(c => c.dist < visionRange);

        if (threats.length > 0) {
            const closestThreat = this.getClosest(threats).cell;
            this.targetX = this.x + (this.x - closestThreat.x);
            this.targetY = this.y + (this.y - closestThreat.y);
            return;
        }

        if (playerCells.length > 0) {
            const weakPlayers = playerCells
                .filter(p => this.mass > p.mass * 1.1 && p.mass < p.radius * 2)
                .map(p => ({ cell: p, dist: Math.hypot(this.x - p.x, this.y - p.y) }));
            
            if (weakPlayers.length > 0) {
                const closestWeak = this.getClosest(weakPlayers).cell;
                this.targetX = closestWeak.x;
                this.targetY = closestWeak.y;
                return;
            }
        }
        
        if (food.length > 0) {
            const foodWithDist = food.map(f => ({ cell: f, dist: Math.hypot(this.x - f.x, this.y - f.y) }));
            const closestFood = this.getClosest(foodWithDist).cell;
            this.targetX = closestFood.x;
            this.targetY = closestFood.y;
        } else {
            this.wander();
        }
    }

    wander() {
        this.targetX = this.x + randomInRange(-500, 500);
        this.targetY = this.y + randomInRange(-500, 500);
    }

    move() {
        const maxSpeed = Math.max(1.5, 6 - this.mass / 100);
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.hypot(dx, dy);
        let targetVx = 0, targetVy = 0;

        if (distance > this.radius && distance > 0) {
            targetVx = (dx / distance) * maxSpeed;
            targetVy = (dy / distance) * maxSpeed;
        }
        const lerpFactor = 0.1;
        this.velocityX += (targetVx - this.velocityX) * lerpFactor;
        this.velocityY += (targetVy - this.velocityY) * lerpFactor;
    }

    update() {
        this.updatePosition();
    }
}

class EmployeeBot extends Cell {
    constructor(x, y, owner, abilityTier) {
        super(x, y, EMPLOYEE_BOT_MASS, owner.color, ""); 
        this.owner = owner;
        this.abilityTier = abilityTier;
        const stats = ABILITY_STATS['gatherer'].tiers[this.abilityTier - 1];

        this.state = 'gathering'; // States: 'gathering', 'returning'
        this.targetFood = null;
        this.carriedMass = 0;
        this.capacity = stats.capacity;
        this.tripsMade = 0;
        this.maxTrips = stats.max_trips;
        this.lifespan = 120 * 60; // 2-minute lifespan
        this.isSpawning = true;
        this.wanderTarget = null;
        setTimeout(() => this.isSpawning = false, 1000);
    }

    updateAi(allCells, food, playerCells) {
        this.lifespan--;
        if (this.lifespan <= 0) {
            this.mass = 0;
            return;
        }
        
        if (this.isSpawning) return;

        // --- Determine Target ---
        let targetPos = null;
        if (this.state === 'gathering') {
            if (this.carriedMass >= this.capacity) {
                this.state = 'returning';
                this.targetFood = null;
            }

            if (!this.targetFood || !food.includes(this.targetFood)) {
                const foodInRange = food
                    .map(f => ({ cell: f, dist: Math.hypot(this.x - f.x, this.y - f.y) }))
                    .filter(f => f.dist < 1000);
                
                if (foodInRange.length > 0) {
                    this.targetFood = foodInRange.reduce((closest, current) => (current.dist < closest.dist ? current : closest)).cell;
                }
            }
            
            if (this.targetFood) {
                targetPos = { x: this.targetFood.x, y: this.targetFood.y };
            } else {
                if (!this.wanderTarget || Math.hypot(this.x - this.wanderTarget.x, this.y - this.wanderTarget.y) < 50) {
                    this.wanderTarget = {x: this.x + randomInRange(-500, 500), y: this.y + randomInRange(-500, 500)};
                }
                targetPos = this.wanderTarget;
            }
        }

        if (this.state === 'returning') {
            const ownerCells = playerCells.filter(p => p.mass > 0);
            if (ownerCells.length === 0) {
                this.mass = 0; // Despawn if owner is dead
                return;
            }
            const closestOwnerCell = ownerCells.map(c => ({cell: c, dist: Math.hypot(this.x - c.x, this.y - c.y)}))
                                               .reduce((a, b) => a.dist < b.dist ? a : b).cell;
            targetPos = { x: closestOwnerCell.x, y: closestOwnerCell.y };

            const distToOwner = Math.hypot(this.x - closestOwnerCell.x, this.y - closestOwnerCell.y);
            if (distToOwner < closestOwnerCell.radius) {
                closestOwnerCell.mass += this.carriedMass;
                this.carriedMass = 0;
                this.tripsMade++;
                if (this.tripsMade >= this.maxTrips) {
                    closestOwnerCell.mass += this.mass; // Deposit own mass on last trip
                    this.mass = 0; 
                } else {
                    this.state = 'gathering';
                }
            }
        }

        // --- Steering Behavior Calculation ---
        let seekVector = { x: 0, y: 0 };
        if (targetPos) {
            seekVector.x = targetPos.x - this.x;
            seekVector.y = targetPos.y - this.y;
        }

        let fleeVector = { x: 0, y: 0 };
        const threats = allCells
            .filter(c => c !== this && c.mass > this.mass * 1.1 && !(c instanceof EmployeeBot) && !playerCells.includes(c))
            .map(c => ({ cell: c, dist: Math.hypot(this.x - c.x, this.y - c.y) }))
            .filter(c => c.dist < this.radius + c.cell.radius + 150); // Dodge range

        if (threats.length > 0) {
            for (const threat of threats) {
                const awayX = this.x - threat.cell.x;
                const awayY = this.y - threat.cell.y;
                fleeVector.x += awayX / (threat.dist * threat.dist);
                fleeVector.y += awayY / (threat.dist * threat.dist);
            }
        }

        const fleeWeight = 5000;
        this.targetX = this.x + seekVector.x + fleeVector.x * fleeWeight;
        this.targetY = this.y + seekVector.y + fleeVector.y * fleeWeight;

        this.move();
    }

    move() {
        const maxSpeed = 12; // Increased speed
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

        // Main body
        ctx.beginPath();
        ctx.arc(screenX, screenY, scaledRadius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        // Inner pulsating core
        const pulse = 1 + Math.sin(this.frame_count * 0.1) * 0.2;
        ctx.beginPath();
        ctx.arc(screenX, screenY, scaledRadius * 0.5 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
    }

    update() {
        this.updatePosition();
    }
}


class Food extends Cell {
    constructor(x, y) {
        super(x, y, FOOD_MASS, FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)]);
    }
    update() {
        this.updatePosition();
    }
}

class EjectedMass extends Cell {
    constructor(x, y, mass, color, velocityX, velocityY) {
        super(x, y, mass, color);
        this.velocityX = velocityX;
        this.velocityY = velocityY;
        this.decayTimer = 180;
    }
    update() {
        this.updatePosition();
        this.decayTimer--;
    }
}

class Particle {
    constructor(x, y, vx, vy, size, color, lifespan) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.size = size; this.color = color; this.lifespan = lifespan;
        this.maxLifespan = lifespan;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.lifespan--;
        this.size = Math.max(0, this.size * (this.lifespan / this.maxLifespan));
    }

    draw(ctx, camera) {
        if (this.lifespan <= 0) return;
        const { screenX, screenY } = camera.worldToScreen(this.x, this.y);
        const size = this.size * camera.zoom;
        if (size < 1) return;

        ctx.save();
        ctx.globalAlpha = this.lifespan / this.maxLifespan;
        ctx.beginPath();
        ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
}

class TargetedMass extends Cell {
    constructor(x, y, mass, color, targetCell) {
        super(x, y, mass, color);
        this.target = targetCell;
        this.lifespan = 300;
        this.playerEatCooldown = 30;
    }

    update() {
        if (this.playerEatCooldown > 0) {
            this.playerEatCooldown--;
        }

        if (this.target && this.target.mass > 0) {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const distance = Math.hypot(dx, dy);
            if (distance > 1) {
                const pullStrength = 5;
                const lerpFactor = 0.1;
                const targetVx = (dx / distance) * pullStrength;
                const targetVy = (dy / distance) * pullStrength;
                this.velocityX += (targetVx - this.velocityX) * lerpFactor;
                this.velocityY += (targetVy - this.velocityY) * lerpFactor;
            }
        }
        this.lifespan--;
        this.updatePosition();
    }
}

class CoalescingMass extends TargetedMass {
    update() {
        if (this.target) {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const distance = Math.hypot(dx, dy);
            if (distance < 10) {
                this.mass = 0; // Disappear when close
            } else {
                const pullStrength = 20;
                const lerpFactor = 0.2;
                const targetVx = (dx / distance) * pullStrength;
                const targetVy = (dy / distance) * pullStrength;
                this.velocityX += (targetVx - this.velocityX) * lerpFactor;
                this.velocityY += (targetVy - this.velocityY) * lerpFactor;
            }
        }
        this.lifespan--;
        this.updatePosition();
    }
}


class ReformMass extends TargetedMass {
    update() {
        if (this.target && this.target.mass > 0) {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const distance = Math.hypot(dx, dy);
            if (distance > 1) {
                const pullStrength = 15;
                const targetVx = (dx / distance) * pullStrength;
                const targetVy = (dy / distance) * pullStrength;
                this.velocityX += (targetVx - this.velocityX) * 0.25;
                this.velocityY += (targetVy - this.velocityY) * 0.25;
            }
        }
        this.lifespan--;
        this.updatePosition();
    }
}

class WebProjectile extends EjectedMass {
    constructor(x, y, vx, vy) {
        super(x, y, 10, WEB_COLOR, vx, vy);
        this.decayTimer = 120;
    }
}

class Tendril {
    constructor(originBot) {
        this.origin = originBot;
        this.target = null;
        this.isAttached = false;
        this.currentLength = 0;
        this.baseAngle = Math.random() * 2 * Math.PI;
        this.waveOffset = Math.random() * 2 * Math.PI;
        this.maxLength = BASE_TENDRIL_LENGTH + (this.origin.mass * TENDRIL_LENGTH_MASS_FACTOR);
    }

    update(allBots) {
        if (this.isAttached) return null;

        if (this.target && (!allBots.includes(this.target) || this.target.isWebbed)) {
            this.target = null;
        }

        if (this.target) {
            const tip = this.getTipPos();
            const distToTarget = Math.hypot(tip.x - this.target.x, tip.y - this.target.y);

            if (distToTarget < this.target.radius + 5) {
                this.isAttached = true;
                return this.target;
            }
            
            this.currentLength += TENDRIL_GROWTH_SPEED * 3;
            this.currentLength = Math.min(this.currentLength, this.maxLength);
            
            this.baseAngle = Math.atan2(this.target.y - this.origin.y, this.target.x - this.origin.x);
        } else {
            if (this.currentLength < this.maxLength) {
                this.currentLength += TENDRIL_GROWTH_SPEED;
            }
            
            const tip = this.getTipPos();
            const potentialTargets = allBots
                .filter(bot => !bot.isWebbed && Math.hypot(this.origin.x - bot.x, this.origin.y - bot.y) < this.currentLength && Math.hypot(this.origin.x - bot.x, this.origin.y - bot.y) > this.origin.radius)
                .map(bot => ({ bot, dist: Math.hypot(tip.x - bot.x, tip.y - bot.y) }));
            
            if (potentialTargets.length > 0) {
                this.target = potentialTargets.reduce((closest, current) => current.dist < closest.dist ? current : closest).bot;
            }
        }
        return null;
    }

    getTipPos() {
        let currentAngle = this.baseAngle;
        if (!this.target) {
            this.waveOffset += TENDRIL_WAVE_SPEED;
            currentAngle += Math.sin(this.waveOffset) * TENDRIL_WAVE_AMPLITUDE;
        }
        
        return {
            x: this.origin.x + this.currentLength * Math.cos(currentAngle),
            y: this.origin.y + this.currentLength * Math.sin(currentAngle)
        };
    }

    draw(ctx, camera) {
        const numSegments = 15;
        const points = [];
        
        for (let i = 0; i <= numSegments; i++) {
            const progress = i / numSegments;
            const length = this.currentLength * progress;
            
            let currentAngle = this.baseAngle;
            if (!this.target) {
                const wavePhase = this.waveOffset + progress * 2;
                currentAngle += Math.sin(wavePhase) * TENDRIL_WAVE_AMPLITUDE * progress;
            }
            
            const pointX = this.origin.x + length * Math.cos(currentAngle);
            const pointY = this.origin.y + length * Math.sin(currentAngle);
            points.push(camera.worldToScreen(pointX, pointY));
        }
            
        if (points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(points[0].screenX, points[0].screenY);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].screenX, points[i].screenY);
            }
            ctx.strokeStyle = WEB_COLOR;
            ctx.lineWidth = Math.max(1, 2 * camera.zoom);
            ctx.stroke();
        }
    }
}

class Web {
    constructor(initialBot, abilityLevel) {
        this.webbedBots = new Set([initialBot]);
        this.tendrils = [];
        initialBot.isWebbed = true;
        initialBot.creepRadius = 1.0;
        this.creepFoodSpawnTimer = CREEP_FOOD_SPAWN_RATE;
        
        this.abilityLevel = abilityLevel;
        this.stats = ABILITY_STATS['parasite_shot']['tiers'][this.abilityLevel - 1];
        this.maxSpread = this.stats.max_spread;
        this.spreadCount = 1;
    }

    update(allBots, foodList, frameCount, creepCtx) {
        this.webbedBots = new Set([...this.webbedBots].filter(bot => allBots.includes(bot)));
        this.tendrils = this.tendrils.filter(t => this.webbedBots.has(t.origin) && (!t.isAttached || (t.target && allBots.includes(t.target))));

        const newlyInfected = new Set();
        for (const tendril of this.tendrils) {
            if (!tendril.isAttached) {
                const infectedBot = tendril.update(allBots);
                if (infectedBot && !infectedBot.isWebbed) {
                    infectedBot.isWebbed = true;
                    newlyInfected.add(infectedBot);
                    this.spreadCount++;
                }
            }
        }
        
        newlyInfected.forEach(bot => {
            this.webbedBots.add(bot);
            bot.creepRadius = 1.0;
            
            if (bot.creepShapeOffsets.length === 0) {
                bot.creepShapeOffsets = [];
                const numPoints = 30;
                const seed1 = randomInRange(3, 6);
                const seed2 = randomInRange(9, 14);
                for (let i = 0; i < numPoints; i++) {
                    const angle = (i / numPoints) * 2 * Math.PI;
                    let noise = 0.5 * Math.sin(angle * seed1);
                    noise += 0.25 * Math.sin(angle * seed2);
                    bot.creepShapeOffsets.push(1 + noise * 0.4);
                }
            }
        });

        this.webbedBots.forEach(webbedBot => {
            const maxCreepRadius = MAX_CREEP_RADIUS_BASE + webbedBot.mass * CREEP_RADIUS_MASS_FACTOR;
            if (webbedBot.creepRadius < maxCreepRadius) {
                webbedBot.creepRadius += CREEP_GROWTH_RATE;
                if (webbedBot.creepRadius >= maxCreepRadius && !webbedBot.creepIsPainted) {
                    this.paintCreep(webbedBot, creepCtx);
                    webbedBot.creepIsPainted = true;
                }
            }

            webbedBot.tendrilSpawnTimer--;
            if (webbedBot.tendrilSpawnTimer <= 0) {
                webbedBot.tendrilSpawnTimer = TENDRIL_SPAWN_RATE;
                
                if (this.spreadCount < this.maxSpread) {
                    const currentTendrilCount = this.tendrils.filter(t => t.origin === webbedBot).length;
                    if (currentTendrilCount < this.stats.max_tendrils) {
                        this.tendrils.push(new Tendril(webbedBot));
                    }
                }
            }
        });

        this.creepFoodSpawnTimer--;
        if (this.creepFoodSpawnTimer <= 0 && this.webbedBots.size > 1) {
            this.creepFoodSpawnTimer = CREEP_FOOD_SPAWN_RATE;
            
            const botsArray = Array.from(this.webbedBots);
            const bot1 = botsArray[Math.floor(Math.random() * botsArray.length)];
            let bot2 = botsArray[Math.floor(Math.random() * botsArray.length)];
            while (bot1 === bot2) {
                 bot2 = botsArray[Math.floor(Math.random() * botsArray.length)];
            }

            const spawnX = lerp(bot1.x, bot2.x, Math.random());
            const spawnY = lerp(bot1.y, bot2.y, Math.random());
            
            const newFood = new Food(spawnX, spawnY);
            newFood.color = WEB_COLOR;
            foodList.push(newFood);
        }
    }

    paintCreep(bot, ctx, erase = false) {
        if (bot.creepShapeOffsets.length === 0) return;

        ctx.fillStyle = erase ? 'rgba(0,0,0,0)' : CREEP_COLOR;
        if (erase) {
           ctx.globalCompositeOperation = 'destination-out';
        }
        
        const numPoints = 30;
        const maxCreepRadius = MAX_CREEP_RADIUS_BASE + bot.mass * CREEP_RADIUS_MASS_FACTOR;
        
        ctx.beginPath();
        for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * 2 * Math.PI;
            const r = maxCreepRadius * (bot.creepShapeOffsets[i % numPoints] || 1);
            const px = bot.x + r * Math.cos(angle);
            const py = bot.y + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.fill();
        if (erase) {
            ctx.globalCompositeOperation = 'source-over';
        }
    }


    draw(ctx, camera, frameCount) {
        // Draw dynamic, unpainted creep
        for (const bot of this.webbedBots) {
            if (!bot.creepIsPainted && bot.creepShapeOffsets.length > 0) {
                const { screenX, screenY } = camera.worldToScreen(bot.x, bot.y);
                const scaledCreepRadius = bot.creepRadius * camera.zoom;

                if (scaledCreepRadius < 5) continue;
                if (screenX + scaledCreepRadius * 1.5 < 0 || screenX - scaledCreepRadius * 1.5 > SCREEN_WIDTH ||
                    screenY + scaledCreepRadius * 1.5 < 0 || screenY - scaledCreepRadius * 1.5 > SCREEN_HEIGHT) {
                    continue;
                }
                
                ctx.beginPath();
                const numPoints = 30;
                for (let i = 0; i <= numPoints; i++) {
                    const angle = (i / numPoints) * 2 * Math.PI;
                    const baseRadius = scaledCreepRadius * bot.creepShapeOffsets[i % numPoints];
                    const edgePulse = 3 * Math.sin(frameCount * 0.05 + bot.creepAnimOffset + angle * 4) * camera.zoom;
                    const r = baseRadius + edgePulse;
                    const px = screenX + r * Math.cos(angle);
                    const py = screenY + r * Math.sin(angle);
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.fillStyle = CREEP_COLOR;
                ctx.fill();
            }
        }
        
        this.tendrils.forEach(tendril => tendril.draw(ctx, camera));

        const pulse = (Math.sin(frameCount * 0.1) + 1) / 2;
        for (const bot of this.webbedBots) {
            const { screenX, screenY } = camera.worldToScreen(bot.x, bot.y);
            const radius = bot.radius * camera.zoom;
            const auraRadius = radius * (1.2 + pulse * 0.3);
            const auraAlpha = (50 + pulse * 40) / 255;
            if (auraRadius > 1) {
                ctx.beginPath();
                ctx.arc(screenX, screenY, auraRadius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(148, 0, 211, ${auraAlpha})`;
                ctx.fill();
            }
        }
    }
}

class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.zoom = 1.0;
        this.targetX = 0;
        this.targetY = 0;
        this.targetZoom = 1.0;
    }

    update(playerCells) {
        if (playerCells.length > 0) {
            const totalMass = playerCells.reduce((sum, c) => sum + c.mass, 0);
            const centerX = playerCells.reduce((sum, c) => sum + c.x * c.mass, 0) / totalMass;
            const centerY = playerCells.reduce((sum, c) => sum + c.y * c.mass, 0) / totalMass;
            this.targetX = centerX;
            this.targetY = centerY;
            
            const maxDist = Math.max(...playerCells.map(c => Math.hypot(c.x - centerX, c.y - centerY) + c.radius), 100);
            const zoomRadius = Math.max(playerCells.reduce((sum, c) => sum + c.radius, 0) / 2, maxDist);
            
            this.targetZoom = SCREEN_HEIGHT / (zoomRadius * 4 + 300);
            this.targetZoom = Math.max(0.15, Math.min(this.targetZoom, 1.5));
        }
        const lerpFactor = 0.04;
        this.x += (this.targetX - this.x) * lerpFactor;
        this.y += (this.targetY - this.y) * lerpFactor;
        this.zoom += (this.targetZoom - this.zoom) * lerpFactor;
    }

    worldToScreen(worldX, worldY) {
        return {
            screenX: (worldX - this.x) * this.zoom + SCREEN_WIDTH / 2,
            screenY: (worldY - this.y) * this.zoom + SCREEN_HEIGHT / 2
        };
    }

    screenToWorld(screenX, screenY) {
        return {
            worldX: (screenX - SCREEN_WIDTH / 2) / this.zoom + this.x,
            worldY: (screenY - SCREEN_HEIGHT / 2) / this.zoom + this.y
        };
    }
}

class Game {
    constructor() {
        this.running = true;
        this.playerIsDead = false;
        this.playerName = "Player";
        this.feedCheatActive = false;
        this.spawnRateDoubled = false;
        this.particles = [];
        this.targetedMass = [];
        this.webProjectiles = [];
        this.webs = [];
        this.employees = [];
        this.frame_count = 0;
        this.ejectCooldown = 0;
        this.botSpawnTimer = 0;
        this.foodSpawnTimer = 0;

        // Off-screen canvas for creep
        this.creepCanvas = document.createElement('canvas');
        this.creepCanvas.width = WORLD_WIDTH;
        this.creepCanvas.height = WORLD_HEIGHT;
        this.creepCtx = this.creepCanvas.getContext('2d');
        
        // Ability System
        this.abilityLevels = {'parasite_shot': 0, 'gatherer': 0, 'regroup': 0, 'mass_purge': 0};
        this.abilityCooldowns = {'parasite_shot': 0, 'gatherer': 0, 'regroup': 0, 'mass_purge': 0};
        this.upgradeMenuOpen = false;
        this.warningMessage = "";
        this.warningTimer = 0;

        // Input handling
        this.mousePos = { x: 0, y: 0 };
        this.keysPressed = {};

        this.gameLoop = this.gameLoop.bind(this);
    }

    setup() {
        this.camera = new Camera();
        this.bots = Array.from({ length: INITIAL_BOT_COUNT }, () => new BotCell(Math.random() * WORLD_WIDTH, Math.random() * WORLD_HEIGHT, INITIAL_BOT_MASS));
        this.food = Array.from({ length: FOOD_COUNT }, () => new Food(Math.random() * WORLD_WIDTH, Math.random() * WORLD_HEIGHT));
        this.ejectedMass = [];
        this.particles = [];
        this.targetedMass = [];
        this.webProjectiles = [];
        this.webs = [];
        this.employees = [];
        this.creepCtx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        
        this.abilityLevels = {'parasite_shot': 0, 'gatherer': 0, 'regroup': 0, 'mass_purge': 0};
        this.abilityCooldowns = {'parasite_shot': 0, 'gatherer': 0, 'regroup': 0, 'mass_purge': 0};
        
        this.respawnPlayer();
    }

    respawnPlayer() {
        const spawnPadding = 0.2;
        const startX = randomInRange(WORLD_WIDTH * spawnPadding, WORLD_WIDTH * (1 - spawnPadding));
        const startY = randomInRange(WORLD_HEIGHT * spawnPadding, WORLD_HEIGHT * (1 - spawnPadding));
        
        this.playerCells = [new PlayerCell(startX, startY, INITIAL_PLAYER_MASS, this.playerName)];
        this.playerIsDead = false;

        if (this.camera) {
            this.camera.x = startX;
            this.camera.y = startY;
            this.camera.targetX = startX;
            this.camera.targetY = startY;
        }
    }

    run() {
        this.setup();
        this.addEventListeners();
        this.gameLoop();
    }

    addEventListeners() {
        window.addEventListener('mousemove', e => {
            this.mousePos.x = e.clientX;
            this.mousePos.y = e.clientY;
        });

        window.addEventListener('keydown', e => {
            this.keysPressed[e.key.toLowerCase()] = true;
            this.handleKeyPress(e.key.toLowerCase());
        });
        
        window.addEventListener('keyup', e => {
            this.keysPressed[e.key.toLowerCase()] = false;
        });
        
        canvas.addEventListener('mousedown', e => {
             if (this.playerIsDead || this.upgradeMenuOpen) return;
             // Mouse-based abilities have been moved to key presses
        });

        canvas.addEventListener('mouseup', e => {
            if (this.playerIsDead || this.upgradeMenuOpen) return;
            // Mouse-based abilities have been moved to key presses
        });

        canvas.addEventListener('contextmenu', e => e.preventDefault());
    }

    handleKeyPress(key) {
        if (this.playerIsDead && key === 'enter') {
            this.respawnPlayer();
        } else if (this.upgradeMenuOpen) {
            if (key === '1') this.upgradeAbility('parasite_shot');
            if (key === '2') this.upgradeAbility('gatherer');
            if (key === '3') this.upgradeAbility('regroup');
            if (key === '4') this.upgradeAbility('mass_purge');
            if (key === 'u') this.upgradeMenuOpen = false;
        } else if (!this.playerIsDead) {
            if (key === ' ') this.splitPlayerCells();
            if (key === '1') this.fireWebShot();
            if (key === '2') this.spawnEmployee();
            if (key === '3') this.reformPlayerCells();
            if (key === '4') this.activateMassPurge();
            if (key === 'q') this.feedCheatActive = !this.feedCheatActive;
            if (key === 'u') this.upgradeMenuOpen = true;
            if (key === 'z') { // New cheat code
                const abilityKeys = Object.keys(this.abilityLevels);
                for (const abilityKey of abilityKeys) {
                    this.abilityLevels[abilityKey] = 3;
                }
                this.showWarning("Cheats Activated: All abilities maxed!");
            }
        }
    }
    
    gameLoop() {
        if (!this.running) return;
        
        this.frame_count++;
        this.updateGameState();
        this.draw();
        
        requestAnimationFrame(this.gameLoop);
    }
    
    upgradeAbility(abilityKey) {
        const level = this.abilityLevels[abilityKey];
        if (level >= 3) {
            this.showWarning("Ability is already max level!");
            return;
        }

        const cost = ABILITY_STATS[abilityKey].costs[level];
        const totalMass = this.playerCells.reduce((sum, c) => sum + c.mass, 0);

        if (totalMass >= cost) {
            const largestCell = this.playerCells.reduce((max, c) => c.mass > max.mass ? c : max, this.playerCells[0]);
            largestCell.mass -= cost;
            this.abilityLevels[abilityKey]++;
            this.upgradeMenuOpen = false;
        } else {
            this.showWarning("Not enough mass!");
        }
    }

    showWarning(message) {
        this.warningMessage = message;
        this.warningTimer = 120; // 2 seconds
    }

    fireWebShot() {
        const level = this.abilityLevels['parasite_shot'];
        if (level === 0 || this.abilityCooldowns['parasite_shot'] > 0 || this.playerCells.length === 0) return;
        
        const playerCell = this.playerCells.reduce((max, c) => c.mass > max.mass ? c : max, this.playerCells[0]);
        if (playerCell.mass < WEB_SHOT_COST) return;
        
        playerCell.mass -= WEB_SHOT_COST;
        playerCell.updateRadius();

        const { worldX, worldY } = this.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
        const dx = worldX - playerCell.x;
        const dy = worldY - playerCell.y;
        const distance = Math.hypot(dx, dy);
        if (distance === 0) return;
        
        const velX = (dx / distance) * WEB_SHOT_SPEED;
        const velY = (dy / distance) * WEB_SHOT_SPEED;
        this.webProjectiles.push(new WebProjectile(playerCell.x, playerCell.y, velX, velY));
        
        const cooldown = ABILITY_STATS['parasite_shot'].tiers[level - 1].cooldown;
        this.abilityCooldowns['parasite_shot'] = cooldown;
    }

    spawnEmployee() {
        const level = this.abilityLevels['gatherer'];
        if (level === 0 || this.abilityCooldowns['gatherer'] > 0 || this.playerCells.length === 0) return;

        const stats = ABILITY_STATS['gatherer'].tiers[level - 1];
        const cost = stats.cost;
        
        if (this.employees.length >= stats.max_employees) {
            this.showWarning("Maximum number of employees reached!");
            return;
        }

        const playerCell = this.playerCells.reduce((max, c) => c.mass > max.mass ? c : max, this.playerCells[0]);
        if (playerCell.mass < cost + MIN_MASS_TO_EJECT) { // Keep some mass
            this.showWarning("Not enough mass to spawn an employee!");
            return;
        }

        playerCell.mass -= cost;
        playerCell.updateRadius();
        
        const spawnAngle = Math.random() * 2 * Math.PI;
        const spawnDist = playerCell.radius + 30;
        const spawnX = playerCell.x + Math.cos(spawnAngle) * spawnDist;
        const spawnY = playerCell.y + Math.sin(spawnAngle) * spawnDist;
        
        const spawnPoint = {x: spawnX, y: spawnY};

        const numChunks = 10;
        const massPerChunk = cost / numChunks;
        for (let i = 0; i < numChunks; i++) {
            const offsetX = randomInRange(-playerCell.radius, playerCell.radius) * 0.7;
            const offsetY = randomInRange(-playerCell.radius, playerCell.radius) * 0.7;
            const newLiquid = new CoalescingMass(playerCell.x + offsetX, playerCell.y + offsetY, massPerChunk, playerCell.color, spawnPoint);
            this.targetedMass.push(newLiquid);
        }

        setTimeout(() => {
            const newEmployee = new EmployeeBot(spawnX, spawnY, playerCell, level);
            this.employees.push(newEmployee);
        }, 500); // Delay spawn to allow for animation

        this.abilityCooldowns['gatherer'] = stats.cooldown;
    }

    reformPlayerCells() {
        const level = this.abilityLevels['regroup'];
        if (level === 0 || this.abilityCooldowns['regroup'] > 0 || this.playerCells.length <= 1) return;

        const { worldX, worldY } = this.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
        const targetCell = this.playerCells.reduce((closest, c) => {
            const dist = Math.hypot(c.x - worldX, c.y - worldY);
            return dist < closest.dist ? { cell: c, dist } : closest;
        }, { cell: this.playerCells[0], dist: Infinity }).cell;

        const cellsToRemove = this.playerCells.filter(cell => cell !== targetCell);
        
        for (const cell of cellsToRemove) {
            const numChunks = Math.floor(cell.mass / 5) + 1;
            const massPerChunk = cell.mass / numChunks;
            for (let i = 0; i < numChunks; i++) {
                const offsetX = randomInRange(-cell.radius, cell.radius) * 0.5;
                const offsetY = randomInRange(-cell.radius, cell.radius) * 0.5;
                const vx = randomInRange(-2, 2);
                const vy = randomInRange(-2, 2);
                const newLiquid = new ReformMass(cell.x + offsetX, cell.y + offsetY, massPerChunk, cell.color, targetCell);
                newLiquid.velocityX = vx;
                newLiquid.velocityY = vy;
                this.targetedMass.push(newLiquid);
            }
        }
        
        this.playerCells = [targetCell];
        
        const cooldown = ABILITY_STATS['regroup'].tiers[level - 1].cooldown;
        this.abilityCooldowns['regroup'] = cooldown;
    }

    activateMassPurge() {
        const level = this.abilityLevels['mass_purge'];
        if (level === 0 || this.abilityCooldowns['mass_purge'] > 0 || this.playerCells.length === 0) return;

        const stats = ABILITY_STATS['mass_purge'].tiers[level - 1];
        const cost = stats.cost;
        
        const playerCell = this.playerCells.reduce((max, c) => c.mass > max.mass ? c : max, this.playerCells[0]);
        if (playerCell.mass < cost) return;
        
        playerCell.mass -= cost;
        playerCell.updateRadius();

        const allPurgeable = [...this.bots, ...this.food];
        for (let i = allPurgeable.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allPurgeable[i], allPurgeable[j]] = [allPurgeable[j], allPurgeable[i]];
        }
        
        const numToPurge = Math.floor(allPurgeable.length * stats.affect_percentage);
        for (let i = 0; i < numToPurge; i++) {
            allPurgeable[i].isPurged = true;
            allPurgeable[i].purgeTimer = stats.duration;
            allPurgeable[i].purgeDecayRate = stats.decay_rate;
        }
            
        this.abilityCooldowns['mass_purge'] = 30 * 60;
    }
    
    updateGameState() {
        if (this.upgradeMenuOpen) return;

        if (this.warningTimer > 0) this.warningTimer--;
        for (const key in this.abilityCooldowns) {
            if (this.abilityCooldowns[key] > 0) {
                this.abilityCooldowns[key]--;
            }
        }

        this.spawnRateDoubled = this.keysPressed['a'];

        this.updateFeedCheat();
        this.updateBotSpawning();
        this.updateFoodSpawning();

        if (this.ejectCooldown > 0) this.ejectCooldown--;
        if (this.keysPressed['w'] && this.ejectCooldown <= 0) {
            this.ejectMassFromPlayer();
            this.ejectCooldown = EJECT_COOLDOWN_TIME;
        }

        if (!this.playerIsDead) {
            this.playerCells.forEach(cell => cell.setMovementInput(this.mousePos, this.camera));
        }
        
        const allCellsForAI = [...this.playerCells, ...this.bots, ...this.employees];
        this.bots.forEach(bot => {
            bot.updateAi(allCellsForAI, this.food, this.playerCells, this.camera);
        });
        this.employees.forEach(e => e.updateAi(allCellsForAI, this.food, this.playerCells));
        
        [...this.playerCells, ...this.bots, ...this.ejectedMass, ...this.webProjectiles, ...this.employees].forEach(cell => cell.update());
        this.particles.forEach(p => p.update());
        this.targetedMass.forEach(tm => tm.update());
        this.webs.forEach(web => web.update(this.bots, this.food, this.frame_count, this.creepCtx));
        
        [...this.bots, ...this.food].forEach(cell => {
            if (cell.isPurged) {
                if (cell.purgeTimer > 0) {
                    cell.purgeTimer--;
                    cell.mass *= (1 - cell.purgeDecayRate);
                    cell.updateRadius();
                    if (Math.random() < 0.2) {
                        this.particles.push(new Particle(cell.x, cell.y, randomInRange(-1,1), randomInRange(-1,1), 3, PURGE_COLOR, 30));
                    }
                } else {
                    cell.isPurged = false;
                }
            }
        });
        
        const deadBots = this.bots.filter(b => b.mass <= 1);
        if (deadBots.length > 0) {
            deadBots.forEach(bot => this.removeCell(bot));
        }

        const foodCountBefore = this.food.length;
        const survivingFood = this.food.filter(f => f.mass > 1);
        const foodEatenByPurge = foodCountBefore - survivingFood.length;
        this.food = survivingFood;
        for (let i = 0; i < foodEatenByPurge; i++) {
             this.food.push(new Food(Math.random() * WORLD_WIDTH, Math.random() * WORLD_HEIGHT));
        }

        if (!this.playerIsDead) {
            this.handlePlayerCollisions();
            this.mergePlayerCells();
        }
        
        this.handleProjectileCollisions();

        const eatenThisFrame = new Set();
        const allEaters = [...this.playerCells, ...this.bots, ...this.employees];

        for (const eater of allEaters) {
            // Handle eating food and ejected mass
            for (const consumable of [...this.food, ...this.ejectedMass, ...this.targetedMass]) {
                if (eatenThisFrame.has(consumable)) continue;
                if (eater instanceof PlayerCell && consumable instanceof TargetedMass && consumable.playerEatCooldown > 0) continue;
                if (eater instanceof PlayerCell && consumable instanceof EmployeeBot) continue; // Player can't eat employees
                
                if (this.checkEat(eater, consumable)) {
                    if (eater instanceof EmployeeBot) {
                        if (consumable instanceof Food) {
                             eater.carriedMass += consumable.mass;
                             eatenThisFrame.add(consumable);
                        }
                    } else {
                        eater.mass += consumable.mass;
                        eatenThisFrame.add(consumable);
                    }
                }
            }
            // Handle eating other cells
            for (const otherEater of allEaters) {
                if (eater === otherEater || eatenThisFrame.has(otherEater)) continue;
                if (eater instanceof PlayerCell && otherEater instanceof EmployeeBot) continue; // Player can't eat employees
                
                if (this.checkEat(eater, otherEater)) {
                    eater.mass += otherEater.mass;
                    eatenThisFrame.add(otherEater);
                }
            }
        }
        
        eatenThisFrame.forEach(eatenItem => {
            if (eatenItem instanceof BotCell) {
                this.removeCell(eatenItem);
            } else if (eatenItem instanceof PlayerCell) {
                const index = this.playerCells.indexOf(eatenItem);
                if (index > -1) this.playerCells.splice(index, 1);
            } else if (eatenItem instanceof Food) {
                 const index = this.food.indexOf(eatenItem);
                if (index > -1) {
                    this.food.splice(index, 1);
                    this.food.push(new Food(Math.random() * WORLD_WIDTH, Math.random() * WORLD_HEIGHT));
                }
            }
        });

        this.ejectedMass = this.ejectedMass.filter(m => !eatenThisFrame.has(m));
        this.targetedMass = this.targetedMass.filter(tm => !eatenThisFrame.has(tm) && tm.mass > 0);
        this.employees = this.employees.filter(e => e.mass > 1 && !eatenThisFrame.has(e));


        [...this.playerCells, ...this.bots, ...this.employees].forEach(cell => cell.updateRadius());

        this.particles = this.particles.filter(p => p.lifespan > 0);
        this.webProjectiles = this.webProjectiles.filter(p => p.decayTimer > 0);
        this.webs = this.webs.filter(w => w.webbedBots.size > 0);
        
        this.camera.update(this.playerCells);
        if (this.playerCells.length === 0 && !this.playerIsDead) this.playerIsDead = true;
    }

    handleProjectileCollisions() {
        this.webProjectiles = this.webProjectiles.filter(proj => {
            for (const bot of this.bots) {
                if (!bot.isWebbed && this.checkEat(proj, bot)) {
                    const level = this.abilityLevels['parasite_shot'];
                    if (level > 0) { this.webs.push(new Web(bot, level)); }
                    return false;
                }
            }
            return true;
        });
    }
    
    updateFeedCheat() {
        if (!this.feedCheatActive || this.playerCells.length === 0 || this.bots.length === 0) return;
        const playerCell = this.playerCells.reduce((max, c) => c.mass > max.mass ? c : max, this.playerCells[0]);
        
        const totalDrain = FEED_CHEAT_DRAIN_RATE + (playerCell.mass * FEED_CHEAT_PERCENT_DRAIN);

        if (playerCell.mass > MIN_MASS_TO_EJECT) {
            playerCell.mass -= totalDrain;
            playerCell.updateRadius();
            
            if (this.frame_count % 5 === 0) {
                const targetBot = this.bots[Math.floor(Math.random() * this.bots.length)];
                const massFromScale = playerCell.mass * FEED_CHEAT_MASS_SCALE_PERCENT;
                const currentChunkMass = BASE_FEED_CHEAT_CHUNK_MASS + massFromScale;
                
                const angle = Math.random() * 2 * Math.PI;
                const speed = 15;
                const spawnX = playerCell.x + Math.cos(angle) * (playerCell.radius + 5);
                const spawnY = playerCell.y + Math.sin(angle) * (playerCell.radius + 5);

                const newFeed = new TargetedMass(spawnX, spawnY, currentChunkMass, FEED_CHEAT_COLOR, targetBot);
                newFeed.velocityX = Math.cos(angle) * speed;
                newFeed.velocityY = Math.sin(angle) * speed;
                this.targetedMass.push(newFeed);
            }
        }
    }

    updateBotSpawning() {
        let currentRate = NORMAL_SPAWN_RATE;
        if (this.spawnRateDoubled) {
            currentRate /= 2;
        }

        this.botSpawnTimer--;
        if (this.botSpawnTimer <= 0) {
            this.botSpawnTimer = currentRate;
            if (this.bots.length < MAX_BOT_COUNT) {
                this.bots.push(new BotCell(Math.random() * WORLD_WIDTH, Math.random() * WORLD_HEIGHT, INITIAL_BOT_MASS));
            }
        }
    }

    updateFoodSpawning() {
        if (this.spawnRateDoubled) { // If 'A' key is held
            this.foodSpawnTimer--;
            if (this.foodSpawnTimer <= 0) {
                this.foodSpawnTimer = FOOD_CHEAT_SPAWN_RATE;
                if (this.food.length < FOOD_COUNT * 2) {
                     this.food.push(new Food(Math.random() * WORLD_WIDTH, Math.random() * WORLD_HEIGHT));
                }
            }
        }
    }

    splitPlayerCells() {
        const newCells = [];
        const { worldX, worldY } = this.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
        const cellsToSplit = [...this.playerCells];

        for (const cell of cellsToSplit) {
            if (cell.mass >= MIN_MASS_TO_SPLIT) {
                this.playerCells.splice(this.playerCells.indexOf(cell), 1);
                
                let dx = worldX - cell.x;
                let dy = worldY - cell.y;
                let distance = Math.hypot(dx, dy);

                if (distance === 0) { dx = 1; dy = 0; distance = 1; }
                
                const newMass = cell.mass / 2;
                const cell1 = new PlayerCell(cell.x, cell.y, newMass, this.playerName, cell.color);
                const cell2 = new PlayerCell(cell.x, cell.y, newMass, this.playerName, cell.color);
                
                const dynamicMergeTime = BASE_MERGE_TIME + Math.floor(cell.mass * MASS_MERGE_TIME_FACTOR);
                cell1.mergeTimer = dynamicMergeTime;
                cell2.mergeTimer = dynamicMergeTime;
                cell1.collisionCooldown = COLLISION_COOLDOWN_TIME;
                cell2.collisionCooldown = COLLISION_COOLDOWN_TIME;
                
                cell2.velocityX = (dx / distance) * SPLIT_VELOCITY;
                cell2.velocityY = (dy / distance) * SPLIT_VELOCITY;
                cell1.velocityX = cell.velocityX;
                cell1.velocityY = cell.velocityY;
                
                newCells.push(cell1, cell2);
            }
        }
        this.playerCells.push(...newCells);
    }

    ejectMassFromPlayer() {
        const { worldX, worldY } = this.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
        for (const cell of this.playerCells) {
            if (cell.mass >= MIN_MASS_TO_EJECT) {
                cell.mass -= EJECTED_MASS_AMOUNT;
                cell.updateRadius();
                
                let dx = worldX - cell.x;
                let dy = worldY - cell.y;
                let distance = Math.hypot(dx, dy);
                if (distance === 0) { dx = 1; dy = 0; distance = 1; }
                
                const ejectX = cell.x + (dx / distance) * cell.radius;
                const ejectY = cell.y + (dy / distance) * cell.radius;
                const velX = (dx / distance) * EJECT_VELOCITY;
                const velY = (dy / distance) * EJECT_VELOCITY;
                
                this.ejectedMass.push(new EjectedMass(ejectX, ejectY, EJECTED_MASS_AMOUNT, cell.color, velX, velY));
            }
        }
    }

    handlePlayerCollisions() {
        if (this.playerCells.length <= 1) return;
        for (let i = 0; i < this.playerCells.length; i++) {
            for (let j = i + 1; j < this.playerCells.length; j++) {
                const c1 = this.playerCells[i];
                const c2 = this.playerCells[j];
                if (c1.collisionCooldown > 0 || c2.collisionCooldown > 0) {
                    const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
                    if (dist < c1.radius + c2.radius && dist > 0) {
                        const overlap = (c1.radius + c2.radius) - dist;
                        const dx = c2.x - c1.x;
                        const dy = c2.y - c1.y;
                        const pushX = (dx / dist) * overlap * 0.5;
                        const pushY = (dy / dist) * overlap * 0.5;
                        c1.x -= pushX; c1.y -= pushY;
                        c2.x += pushX; c2.y += pushY;
                    }
                }
            }
        }
    }

    mergePlayerCells() {
        if (this.playerCells.length <= 1) return;
        const mergedIndices = new Set();
        const nextPlayerCells = [];

        for (let i = 0; i < this.playerCells.length; i++) {
            if (mergedIndices.has(i)) continue;
            let c1 = this.playerCells[i];

            for (let j = i + 1; j < this.playerCells.length; j++) {
                if (mergedIndices.has(j)) continue;
                let c2 = this.playerCells[j];

                if (c1.mergeTimer === 0 && c2.mergeTimer === 0) {
                    const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
                    if (dist < (c1.radius + c2.radius) / 2) {
                        const [larger, smaller] = c1.mass > c2.mass ? [c1, c2] : [c2, c1];
                        larger.mass += smaller.mass;
                        larger.updateRadius();
                        
                        mergedIndices.add(smaller === c1 ? i : j);
                        c1 = larger;
                    }
                }
            }
            nextPlayerCells.push(c1);
        }
        this.playerCells = nextPlayerCells;
    }
    
    removeCell(cellToRemove) {
        if (cellToRemove instanceof BotCell) {
            // If the bot's creep was fully painted, erase it from the creep canvas.
            if (cellToRemove.isWebbed && cellToRemove.creepIsPainted) {
                // Create a temporary web object to call the paintCreep utility.
                const tempWeb = new Web(cellToRemove, 1);
                tempWeb.paintCreep(cellToRemove, this.creepCtx, true); // true = erase
            }
            const botIndex = this.bots.indexOf(cellToRemove);
            if (botIndex > -1) {
                this.bots.splice(botIndex, 1);
            }
        }
    }

    checkEat(eater, eaten) {
        const dist = Math.hypot(eater.x - eaten.x, eater.y - eaten.y);
        
        if (eater instanceof WebProjectile) {
            return dist < eater.radius + eaten.radius;
        }
        
        if (eaten instanceof Food || eaten instanceof EjectedMass || eaten instanceof TargetedMass) {
            return dist < eater.radius;
        }

        if (eater.mass < eaten.mass * 1.1) {
            return false;
        }
        
        return dist < eater.radius;
    }

    draw() {
        ctx.fillStyle = WHITE;
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

        ctx.save();
        ctx.translate(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
        ctx.scale(this.camera.zoom, this.camera.zoom);
        ctx.translate(-this.camera.x, -this.camera.y);

        this.drawGrid();

        const { worldX: viewX, worldY: viewY } = this.camera.screenToWorld(0, 0);
        const viewW = SCREEN_WIDTH / this.camera.zoom;
        const viewH = SCREEN_HEIGHT / this.camera.zoom;
        ctx.drawImage(this.creepCanvas, viewX, viewY, viewW, viewH, viewX, viewY, viewW, viewH);

        ctx.restore();

        [...this.bots, ...this.food].forEach(cell => {
             if (cell.isPurged) {
                const pulse = (Math.sin(this.frame_count * 0.2) + 1) / 2;
                const { screenX, screenY } = this.camera.worldToScreen(cell.x, cell.y);
                const radius = cell.radius * this.camera.zoom * (1.1 + pulse * 0.2);
                const alpha = (100 + pulse * 50) / 255;
                if (radius > 1) {
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, radius, 0, 2 * Math.PI);
                    ctx.fillStyle = `rgba(0, 255, 100, ${alpha})`;
                    ctx.fill();
                }
            }
        });

        const allObjects = [...this.food, ...this.ejectedMass, ...this.bots, ...this.employees, ...this.playerCells, ...this.targetedMass, ...this.webProjectiles];
        allObjects.sort((a, b) => a.mass - b.mass);
        allObjects.forEach(obj => obj.draw(ctx, this.camera));
        
        this.particles.forEach(p => p.draw(ctx, this.camera));
        
        this.webs.forEach(web => web.draw(ctx, this.camera, this.frame_count));

        if (this.playerIsDead) { 
            this.drawDeathScreen();
        } else if (this.playerCells && this.playerCells.length > 0) { 
            this.drawHud();
        }
        
        this.drawWarning();

        if (this.upgradeMenuOpen) {
            this.drawUpgradeMenu();
        }
    }

    drawGrid() {
        const gridSpacing = 50;
        ctx.beginPath();
        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth = 1 / this.camera.zoom;

        const {worldX: viewX, worldY: viewY} = this.camera.screenToWorld(0, 0);
        const viewW = SCREEN_WIDTH / this.camera.zoom;
        const viewH = SCREEN_HEIGHT / this.camera.zoom;

        const startX = Math.floor(viewX / gridSpacing) * gridSpacing;
        const endX = startX + viewW + gridSpacing;
        const startY = Math.floor(viewY / gridSpacing) * gridSpacing;
        const endY = startY + viewH + gridSpacing;

        for (let x = startX; x < endX; x += gridSpacing) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }
        for (let y = startY; y < endY; y += gridSpacing) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        ctx.stroke();
    }
            
    drawHud() {
        if (!this.playerCells || this.playerCells.length === 0) return;
        const totalMass = this.playerCells.reduce((sum, c) => sum + c.mass, 0);
        
        ctx.font = '30px arial';
        ctx.fillStyle = FONT_COLOR;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`Mass: ${Math.floor(totalMass)}`, 10, 10);
        ctx.fillText(`Bots: ${this.bots.length}/${MAX_BOT_COUNT}`, 10, 40);
        ctx.fillText(`Employees: ${this.employees.length}`, 10, 70);


        let yOffset = 100;
        if (this.feedCheatActive) {
            ctx.fillStyle = FEED_CHEAT_COLOR;
            ctx.fillText('Feed Cheat Active!', 10, yOffset);
            yOffset += 30;
        }
        if (this.spawnRateDoubled) {
            ctx.fillStyle = 'green';
            ctx.fillText('Bot & Food Spawn Rate Doubled!', 10, yOffset);
        }
        
        ctx.font = '20px arial';
        
        // Check if any upgrade is affordable
        let canUpgrade = false;
        for (const key of Object.keys(this.abilityLevels)) {
            const level = this.abilityLevels[key];
            if (level < 3) {
                const cost = ABILITY_STATS[key].costs[level];
                if (totalMass >= cost) {
                    canUpgrade = true;
                    break;
                }
            }
        }

        if (canUpgrade) {
            const glow = Math.abs(Math.sin(this.frame_count * 0.05)) * 15;
            ctx.shadowColor = UI_GOLD;
            ctx.shadowBlur = glow;
            ctx.fillStyle = UI_GOLD;
        } else {
            ctx.fillStyle = FONT_COLOR;
        }
        
        ctx.fillText("Press 'U' for Upgrades", 10, SCREEN_HEIGHT - 30);
        
        // Reset shadow and color for other HUD elements
        ctx.shadowBlur = 0;
        ctx.fillStyle = FONT_COLOR;

        this.drawScoreboard();
        this.drawMinimap();
        this.drawCooldowns();
    }

    drawCooldowns() {
        const cooldownKeys = ['parasite_shot', 'gatherer', 'regroup', 'mass_purge'];
        const iconSize = 50;
        const margin = 10;
        const startX = SCREEN_WIDTH - 210;
        const startY = SCREEN_HEIGHT - margin - iconSize;

        let i = 0;
        for (const key of cooldownKeys) {
            const level = this.abilityLevels[key];
            if (level === 0) continue;

            const x = startX - i * (iconSize + margin);
            const y = startY;
            const ability = ABILITY_STATS[key];
            
            ctx.fillStyle = UI_GRAY;
            ctx.fillRect(x, y, iconSize, iconSize);

            // Draw Ability Name (first word)
            const abilityName = ability.name.split(' ')[0];
            ctx.font = '12px arial';
            ctx.fillStyle = WHITE;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(abilityName, x + iconSize / 2, y + 10);

            const cooldown = this.abilityCooldowns[key];
            if (cooldown > 0) {
                const stats = ability.tiers[level - 1];
                let maxCooldown = stats.cooldown || 1;
                if (key === 'mass_purge') maxCooldown = 30 * 60;
                
                if (maxCooldown > 0) {
                    const ratio = cooldown / maxCooldown;
                    const overlayHeight = iconSize * ratio;
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    ctx.fillRect(x, y, iconSize, overlayHeight);
                    
                    // Draw Cooldown Text
                    ctx.font = 'bold 20px arial';
                    ctx.fillStyle = WHITE;
                    ctx.fillText(`${(cooldown / 60).toFixed(1)}`, x + iconSize / 2, y + iconSize / 2 + 5);
                }
            } else {
                // Draw Key Name when not on cooldown
                ctx.font = 'bold 24px arial';
                ctx.fillStyle = WHITE;
                ctx.fillText(ability.key_name, x + iconSize / 2, y + iconSize / 2 + 5);
            }
            
            ctx.strokeStyle = WHITE;
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, iconSize, iconSize);
            i++;
        }
    }

    drawUpgradeMenu() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

        const menuWidth = 700, menuHeight = 500;
        const menuX = SCREEN_WIDTH / 2 - menuWidth / 2;
        const menuY = SCREEN_HEIGHT / 2 - menuHeight / 2;
        
        ctx.fillStyle = UI_GRAY;
        ctx.fillRect(menuX, menuY, menuWidth, menuHeight);
        ctx.strokeStyle = WHITE;
        ctx.lineWidth = 3;
        ctx.strokeRect(menuX, menuY, menuWidth, menuHeight);

        ctx.font = '30px arial';
        ctx.fillStyle = WHITE;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText("Abilities", menuX + 20, menuY + 15);

        const totalMass = Math.floor(this.playerCells.reduce((sum, c) => sum + c.mass, 0));
        ctx.font = '20px arial';
        ctx.textAlign = 'right';
        ctx.fillText(`Your Mass: ${totalMass}`, menuX + menuWidth - 20, menuY + 20);

        const abilityKeys = ['parasite_shot', 'gatherer', 'regroup', 'mass_purge'];
        const startY = menuY + 70;
        for (let i = 0; i < abilityKeys.length; i++) {
            const key = abilityKeys[i];
            const level = this.abilityLevels[key];
            const stats = ABILITY_STATS[key];
            const y = startY + i * 105;
            
            ctx.textAlign = 'left';
            ctx.font = 'bold 24px arial';
            ctx.fillStyle = UI_GOLD;
            ctx.fillText(`[${i+1}] ${stats.name}`, menuX + 30, y);
            
            const desc = level === 0 ? stats.description : (level < 3 ? "Next Level: " + stats.tiers[level].desc : "Max Level");
            ctx.font = '16px arial';
            ctx.fillStyle = WHITE;
            ctx.fillText(desc, menuX + 30, y + 35);

            for (let rank = 0; rank < 3; rank++) {
                ctx.fillStyle = rank < level ? UI_GOLD : 'rgb(50, 50, 50)';
                ctx.fillRect(menuX + 30 + rank * 40, y + 60, 30, 15);
            }

            ctx.textAlign = 'right';
            ctx.font = '20px arial';
            if (level >= 3) {
                ctx.fillStyle = UI_GREEN;
                ctx.fillText("MAX LEVEL", menuX + menuWidth - 30, y + 15);
            } else {
                const cost = stats.costs[level];
                ctx.fillStyle = totalMass >= cost ? UI_GREEN : UI_RED;
                const costStr = (level === 0 ? "Unlock Cost: " : "Upgrade Cost: ") + cost;
                ctx.fillText(costStr, menuX + menuWidth - 30, y + 15);
            }
        }
    }

    drawWarning() {
        if (this.warningTimer > 0) {
            ctx.font = '30px arial';
            ctx.fillStyle = UI_RED;
            ctx.textAlign = 'center';
            ctx.fillText(this.warningMessage, SCREEN_WIDTH / 2, SCREEN_HEIGHT - 100);
        }
    }

    drawDeathScreen() {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 72px arial';
        ctx.fillStyle = DEATH_MESSAGE_COLOR;
        ctx.fillText('You Died!', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 50);
        
        ctx.font = '30px arial';
        ctx.fillStyle = FONT_COLOR;
        ctx.fillText('Press ENTER to respawn', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 20);
    }

    drawScoreboard() {
        const allCells = [...this.playerCells, ...this.bots, ...this.employees];
        allCells.sort((a, b) => b.mass - a.mass);
        const top5 = allCells.slice(0, 5);
        
        const startX = SCREEN_WIDTH - 210;
        const startY = 10;
        
        ctx.font = '20px arial';
        ctx.fillStyle = FONT_COLOR;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText("Leaderboard", startX, startY);

        for (let i = 0; i < top5.length; i++) {
            const cell = top5[i];
            let cellColor = FONT_COLOR;
            if (cell instanceof PlayerCell) cellColor = 'blue';
            if (cell instanceof EmployeeBot) cellColor = 'green';
            
            ctx.fillStyle = cellColor;
            ctx.fillText(`${i+1}. ${cell.name || 'Player'}: ${Math.floor(cell.mass)}`, startX, startY + 25 * (i + 1));
        }
    }

    drawMinimap() {
        const mapWidth = 150;
        const mapHeight = 150;
        const margin = 10;
        const mapX = SCREEN_WIDTH - mapWidth - margin;
        const mapY = SCREEN_HEIGHT - mapHeight - margin;

        ctx.fillStyle = 'rgba(200, 200, 200, 0.6)';
        ctx.fillRect(mapX, mapY, mapWidth, mapHeight);
        ctx.strokeStyle = BLACK;
        ctx.lineWidth = 1;
        ctx.strokeRect(mapX, mapY, mapWidth, mapHeight);

        this.bots.forEach(bot => {
            const dotX = mapX + (bot.x / WORLD_WIDTH) * mapWidth;
            const dotY = mapY + (bot.y / WORLD_HEIGHT) * mapHeight;
            ctx.beginPath();
            ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
            ctx.fillStyle = 'red';
            ctx.fill();
        });
        
        this.employees.forEach(bot => {
            const dotX = mapX + (bot.x / WORLD_WIDTH) * mapWidth;
            const dotY = mapY + (bot.y / WORLD_HEIGHT) * mapHeight;
            ctx.beginPath();
            ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
            ctx.fillStyle = 'yellow';
            ctx.fill();
        });

        if (this.playerCells && this.playerCells.length > 0) {
            const playerCenterX = this.playerCells.reduce((sum, c) => sum + c.x, 0) / this.playerCells.length;
            const playerCenterY = this.playerCells.reduce((sum, c) => sum + c.y, 0) / this.playerCells.length;
            const dotX = mapX + (playerCenterX / WORLD_WIDTH) * mapWidth;
            const dotY = mapY + (playerCenterY / WORLD_HEIGHT) * mapHeight;
            ctx.beginPath();
            ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
            ctx.fillStyle = 'blue';
            ctx.fill();
        }
    }
}


// --- Main Execution ---
window.addEventListener('load', () => {
    const startMenu = document.getElementById('startMenu');
    const startButton = document.getElementById('startButton');
    
    startButton.addEventListener('click', () => {
        startMenu.style.display = 'none';
        const game = new Game();
        game.run();
    });
});
