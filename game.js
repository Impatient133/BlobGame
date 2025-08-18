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
const UI_GRAY = 'rgb(80, 80, 80)';
const UI_GREEN = 'rgb(0, 200, 0)';
const UI_RED = 'rgb(200, 0, 0)';
const UI_GOLD = 'rgb(255, 215, 0)';
const NECROMANCER_COLOR = 'rgb(138, 43, 226)';
const ZOMBIE_COLOR = 'rgb(107, 142, 35)';
const MAGE_COLOR = 'rgb(0, 191, 255)';
const ICE_WALL_COLOR = 'rgba(173, 216, 230, 0.8)';


// --- Game Settings ---
const INITIAL_PLAYER_MASS = 20;
const INITIAL_BOT_MASS = 15;
const ZOMBIE_BOT_MASS = 25;
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

// --- Bot Spawning Settings ---
const NORMAL_SPAWN_RATE = 90;

// --- Class System Settings ---
const CLASS_PICK_MASS = 150;
const CLASS_STATS = {
    'Necromancer': {
        'name': 'Necromancer',
        'description': 'Infect enemies to turn them into zombie gatherers. Absorb your zombies to teleport.',
        'abilities': {
            'possess': {'name': 'Possess', 'key_name': '1', 'cooldown': 5 * 60, 'desc': 'Absorb the closest zombie to your cursor and reform at its location.'}
        }
    },
    'Mage': {
        'name': 'Mage',
        'description': 'A powerful sorcerer who can manipulate the battlefield.',
        'abilities': {
            'ice_wall': {'name': 'Ice Wall', 'key_name': '1', 'cooldown': 10 * 60, 'desc': 'Create a temporary impassable wall of ice.'},
            'reform': {'name': 'Reform', 'key_name': '3', 'cooldown': 10 * 60, 'desc': 'Quickly pull your mass to your cursor.'}
        }
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

        // Ice wall collision
        for (const wall of iceWalls) {
            const closestX = Math.max(wall.x - wall.width / 2, Math.min(nextX, wall.x + wall.width / 2));
            const closestY = Math.max(wall.y - wall.height / 2, Math.min(nextY, wall.y + wall.height / 2));
            const distance = Math.hypot(nextX - closestX, nextY - closestY);

            if (distance < this.radius) {
                // Simple collision response: stop movement towards wall
                const dx = nextX - this.x;
                const dy = nextY - this.y;
                if (Math.abs(dx) > Math.abs(dy)) { // Moving more horizontally
                   this.velocityX = 0;
                } else { // Moving more vertically
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

    update(iceWalls) {
        if (this.mergeTimer > 0) this.mergeTimer--;
        if (this.collisionCooldown > 0) this.collisionCooldown--;
        this.updatePosition(iceWalls);
    }
}

class BotCell extends Cell {
    constructor(x, y, mass) {
        super(x, y, mass, getRandomColor(), `Bot${Math.floor(Math.random() * 100) + 1}`);
        this.targetX = Math.random() * WORLD_WIDTH;
        this.targetY = Math.random() * WORLD_HEIGHT;
        
        const personalities = ["timid", "aggressive", "opportunist"];
        this.personality = personalities[Math.floor(Math.random() * personalities.length)];
        this.huntingTarget = null;
    }

    updateAi(allCells, food, playerCells, camera) {
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

    update(iceWalls) {
        this.updatePosition(iceWalls);
    }
}

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
        
        const leashDistance = (SCREEN_WIDTH / 2.5) / camera.zoom;
        const distToOwner = Math.hypot(this.x - ownerCenter.x, this.y - ownerCenter.y);

        let targetPos = null;

        // Swarm behavior
        // FIX: Only look for food within the leash distance
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
            // FIX: Ensure constant movement by always having a wander target
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
        const maxSpeed = Math.max(1.5, 6 - this.mass / 100); // Speed based on mass
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

class ReformMass extends TargetedMass {
     constructor(x, y, mass, color, targetCell) {
        super(x, y, mass, color, targetCell);
        this.playerEatCooldown = 0;
    }

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
        this.zombies = [];
        this.iceWalls = [];
        this.frame_count = 0;
        this.ejectCooldown = 0;
        this.botSpawnTimer = 0;
        this.foodSpawnTimer = 0;
        
        // Class System
        this.playerClass = null; // e.g., 'Necromancer', 'Mage'
        this.showClassPicker = false;
        this.abilityCooldowns = {};

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
        this.zombies = [];
        this.iceWalls = [];
        
        this.playerClass = null;
        this.showClassPicker = false;
        this.abilityCooldowns = {};
        
        this.respawnPlayer();
    }

    respawnPlayer() {
        const spawnPadding = 0.2;
        const startX = randomInRange(WORLD_WIDTH * spawnPadding, WORLD_WIDTH * (1 - spawnPadding));
        const startY = randomInRange(WORLD_HEIGHT * spawnPadding, WORLD_HEIGHT * (1 - spawnPadding));
        
        this.playerCells = [new PlayerCell(startX, startY, INITIAL_PLAYER_MASS, this.playerName)];
        this.playerIsDead = false;
        this.playerClass = null;
        this.showClassPicker = false;

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
             if (this.playerIsDead || this.showClassPicker) return;
             if (e.button === 0) { // Left click
                if (this.playerClass === 'Necromancer') this.useNecromancerAbility();
                if (this.playerClass === 'Mage') this.useIceWallAbility();
             }
        });
    }

    handleKeyPress(key) {
        if (this.playerIsDead && key === 'enter') {
            this.respawnPlayer();
        } else if (this.showClassPicker) {
            if (key === '1') this.selectClass('Necromancer');
            if (key === '2') this.selectClass('Mage');
        } else if (!this.playerIsDead) {
            if (key === ' ') this.splitPlayerCells();
            if (key === '1') {
                if (this.playerClass === 'Necromancer') this.useNecromancerAbility();
                if (this.playerClass === 'Mage') this.useIceWallAbility();
            }
            if (key === '3') {
                 if (this.playerClass === 'Mage') this.reformPlayerCells();
            }
            if (key === 'q') this.feedCheatActive = !this.feedCheatActive;
        }
    }
    
    selectClass(className) {
        this.playerClass = className;
        this.showClassPicker = false;
        
        if (this.playerClass === 'Necromancer') {
            this.playerCells.forEach(c => c.color = NECROMANCER_COLOR);
            this.abilityCooldowns['possess'] = 0;
        } else if (this.playerClass === 'Mage') {
            this.playerCells.forEach(c => c.color = MAGE_COLOR);
            this.abilityCooldowns['ice_wall'] = 0;
            this.abilityCooldowns['reform'] = 0;
        }
    }

    gameLoop() {
        if (!this.running) return;
        
        this.frame_count++;
        this.updateGameState();
        this.draw();
        
        requestAnimationFrame(this.gameLoop);
    }

    useNecromancerAbility() {
        if (this.abilityCooldowns['possess'] > 0 || this.zombies.length === 0) return;

        const { worldX, worldY } = this.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
        
        const closestZombie = this.zombies.reduce((closest, z) => {
            const dist = Math.hypot(z.x - worldX, z.y - worldY);
            return dist < closest.dist ? { zombie: z, dist } : closest;
        }, { zombie: null, dist: Infinity }).zombie;

        if (!closestZombie) return;
        
        // FIX: Start new player cell with the ZOMBIE'S mass, not the total player mass.
        const newPlayerCell = new PlayerCell(closestZombie.x, closestZombie.y, closestZombie.mass, this.playerName, NECROMANCER_COLOR);
        
        for (const cell of this.playerCells) {
            const numChunks = Math.floor(cell.mass / 10) + 1;
            const massPerChunk = cell.mass / numChunks;
            for (let i = 0; i < numChunks; i++) {
                const offsetX = randomInRange(-cell.radius, cell.radius) * 0.5;
                const offsetY = randomInRange(-cell.radius, cell.radius) * 0.5;
                const newLiquid = new ReformMass(cell.x + offsetX, cell.y + offsetY, massPerChunk, cell.color, newPlayerCell); // Target the new cell instance
                this.targetedMass.push(newLiquid);
            }
        }

        this.playerCells = [newPlayerCell];
        this.zombies = this.zombies.filter(z => z !== closestZombie);
        this.abilityCooldowns['possess'] = CLASS_STATS.Necromancer.abilities.possess.cooldown;
    }

    useIceWallAbility() {
        if (this.abilityCooldowns['ice_wall'] > 0 || this.playerCells.length === 0) return;

        const { worldX, worldY } = this.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
        const playerCell = this.playerCells[0];
        
        const dx = worldX - playerCell.x;
        const dy = worldY - playerCell.y;
        const angle = Math.atan2(dy, dx) + Math.PI / 2; // Perpendicular angle

        const wallLength = SCREEN_WIDTH / 3 / this.camera.zoom;
        const wallThickness = 15 / this.camera.zoom;

        this.iceWalls.push(new IceWall(worldX, worldY, wallLength, wallThickness, angle));
        this.abilityCooldowns['ice_wall'] = CLASS_STATS.Mage.abilities.ice_wall.cooldown;
    }
    
    reformPlayerCells() {
        if (this.abilityCooldowns['reform'] > 0 || this.playerCells.length <= 1) return;

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
                const newLiquid = new ReformMass(cell.x + offsetX, cell.y + offsetY, massPerChunk, cell.color, targetCell);
                this.targetedMass.push(newLiquid);
            }
        }
        
        this.playerCells = [targetCell];
        this.abilityCooldowns['reform'] = CLASS_STATS.Mage.abilities.reform.cooldown;
    }
    
    updateGameState() {
        if (this.showClassPicker) return;

        for (const key in this.abilityCooldowns) {
            if (this.abilityCooldowns[key] > 0) {
                this.abilityCooldowns[key]--;
            }
        }
        
        const totalMass = this.playerCells.reduce((sum, c) => sum + c.mass, 0);
        if (!this.playerClass && totalMass >= CLASS_PICK_MASS) {
            this.showClassPicker = true;
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
        
        const allCellsForAI = [...this.playerCells, ...this.bots, ...this.zombies];
        this.bots.forEach(bot => {
            bot.updateAi(allCellsForAI, this.food, this.playerCells, this.camera);
        });
        this.zombies.forEach(e => e.updateAi(allCellsForAI, this.food, this.playerCells, this.camera));
        
        [...this.playerCells, ...this.bots, ...this.ejectedMass, ...this.zombies].forEach(cell => cell.update(this.iceWalls));
        this.particles.forEach(p => p.update());
        this.targetedMass.forEach(tm => tm.update());
        this.iceWalls.forEach(wall => wall.update());
        this.iceWalls = this.iceWalls.filter(w => w.lifespan > 0);
        
        if (!this.playerIsDead) {
            this.handlePlayerCollisions();
            this.mergePlayerCells();
        }
        
        const eatenThisFrame = new Set();
        const allEaters = [...this.playerCells, ...this.bots, ...this.zombies];

        for (const eater of allEaters) {
            // Handle eating food and ejected mass
            for (const consumable of [...this.food, ...this.ejectedMass, ...this.targetedMass]) {
                if (eatenThisFrame.has(consumable)) continue;
                if (eater instanceof PlayerCell && consumable instanceof TargetedMass && consumable.playerEatCooldown > 0) continue;
                if (eater instanceof PlayerCell && consumable instanceof ZombieBot) continue;
                
                if (this.checkEat(eater, consumable)) {
                    if (eater instanceof ZombieBot) {
                        if (consumable instanceof Food) {
                             if (this.playerCells.length > 0) {
                                this.playerCells[0].mass += consumable.mass;
                             }
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
                if (eater instanceof PlayerCell && otherEater instanceof ZombieBot) continue;
                
                if (this.checkEat(eater, otherEater)) {
                    // NECROMANCER LOGIC
                    if (eater instanceof PlayerCell && this.playerClass === 'Necromancer' && otherEater instanceof BotCell) {
                        const massToGain = otherEater.mass - ZOMBIE_BOT_MASS;
                        if (massToGain > 0) {
                            eater.mass += massToGain;
                            const newZombie = new ZombieBot(otherEater.x, otherEater.y, eater);
                            this.zombies.push(newZombie);
                            eatenThisFrame.add(otherEater);
                        }
                    } else {
                        eater.mass += otherEater.mass;
                        eatenThisFrame.add(otherEater);
                    }
                }
            }
        }
        
        eatenThisFrame.forEach(eatenItem => {
            if (eatenItem instanceof BotCell) {
                const botIndex = this.bots.indexOf(eatenItem);
                if (botIndex > -1) this.bots.splice(botIndex, 1);
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
        this.zombies = this.zombies.filter(e => e.mass > 1 && !eatenThisFrame.has(e));


        [...this.playerCells, ...this.bots, ...this.zombies].forEach(cell => cell.updateRadius());

        this.particles = this.particles.filter(p => p.lifespan > 0);
        
        this.camera.update(this.playerCells);
        if (this.playerCells.length === 0 && !this.playerIsDead) this.playerIsDead = true;
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
                    // FIX: Changed merge condition to be more lenient and reliable
                    const [larger, smaller] = c1.mass > c2.mass ? [c1, c2] : [c2, c1];
                    if (dist < larger.radius) {
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
    
    checkEat(eater, eaten) {
        const dist = Math.hypot(eater.x - eaten.x, eater.y - eaten.y);
        
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

        ctx.restore();

        const allObjects = [...this.food, ...this.ejectedMass, ...this.bots, ...this.zombies, ...this.playerCells, ...this.targetedMass];
        allObjects.sort((a, b) => a.mass - b.mass);
        allObjects.forEach(obj => obj.draw(ctx, this.camera));
        
        this.iceWalls.forEach(wall => wall.draw(ctx, this.camera));
        this.particles.forEach(p => p.draw(ctx, this.camera));
        
        if (this.playerIsDead) { 
            this.drawDeathScreen();
        } else if (this.playerCells && this.playerCells.length > 0) { 
            this.drawHud();
        }
        
        if (this.showClassPicker) {
            this.drawClassPicker();
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
        if (this.playerClass === 'Necromancer') {
            ctx.fillText(`Zombies: ${this.zombies.length}`, 10, 70);
        }


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
        
        this.drawScoreboard();
        this.drawMinimap();
        if (this.playerClass) {
            this.drawCooldowns();
        }
    }

    drawCooldowns() {
        if (!this.playerClass) return;
        const classAbilities = CLASS_STATS[this.playerClass].abilities;
        const abilityKeys = Object.keys(classAbilities);
        if (abilityKeys.length === 0) return;
        
        const iconSize = 50;
        const margin = 10;
        const startX = SCREEN_WIDTH - 210;
        const startY = SCREEN_HEIGHT - margin - iconSize;

        let i = 0;
        for (const key of abilityKeys) {
            const x = startX - i * (iconSize + margin);
            const y = startY;
            const ability = classAbilities[key];
            
            ctx.fillStyle = UI_GRAY;
            ctx.fillRect(x, y, iconSize, iconSize);

            const abilityName = ability.name.split(' ')[0];
            ctx.font = '12px arial';
            ctx.fillStyle = WHITE;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(abilityName, x + iconSize / 2, y + 10);

            const cooldown = this.abilityCooldowns[key];
            if (cooldown > 0) {
                const maxCooldown = ability.cooldown;
                
                if (maxCooldown > 0) {
                    const ratio = cooldown / maxCooldown;
                    const overlayHeight = iconSize * ratio;
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    ctx.fillRect(x, y, iconSize, overlayHeight);
                    
                    ctx.font = 'bold 20px arial';
                    ctx.fillStyle = WHITE;
                    ctx.fillText(`${(cooldown / 60).toFixed(1)}`, x + iconSize / 2, y + iconSize / 2 + 5);
                }
            } else {
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

    drawClassPicker() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

        const menuWidth = 800, menuHeight = 400;
        const menuX = SCREEN_WIDTH / 2 - menuWidth / 2;
        const menuY = SCREEN_HEIGHT / 2 - menuHeight / 2;
        
        ctx.fillStyle = UI_GRAY;
        ctx.fillRect(menuX, menuY, menuWidth, menuHeight);
        ctx.strokeStyle = WHITE;
        ctx.lineWidth = 3;
        ctx.strokeRect(menuX, menuY, menuWidth, menuHeight);

        ctx.font = 'bold 40px arial';
        ctx.fillStyle = UI_GOLD;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText("Choose Your Class", SCREEN_WIDTH / 2, menuY + 20);

        const classKeys = Object.keys(CLASS_STATS);
        const cardWidth = 350;
        const cardHeight = 250;
        
        for (let i = 0; i < classKeys.length; i++) {
            const key = classKeys[i];
            const classData = CLASS_STATS[key];
            const cardX = menuX + (menuWidth / 2 * i) + (menuWidth / 4) - (cardWidth / 2);
            const cardY = menuY + 100;

            ctx.fillStyle = 'rgb(50,50,50)';
            ctx.fillRect(cardX, cardY, cardWidth, cardHeight);
            ctx.strokeStyle = WHITE;
            ctx.strokeRect(cardX, cardY, cardWidth, cardHeight);

            ctx.font = 'bold 28px arial';
            ctx.fillStyle = UI_GOLD;
            ctx.textAlign = 'center';
            ctx.fillText(`[${i+1}] ${classData.name}`, cardX + cardWidth / 2, cardY + 20);

            ctx.font = '16px arial';
            ctx.fillStyle = WHITE;
            const descriptionLines = classData.description.split('. ');
            for(let j=0; j < descriptionLines.length; j++){
                 ctx.fillText(descriptionLines[j], cardX + cardWidth / 2, cardY + 70 + (j * 20));
            }
           
            const abilities = Object.values(classData.abilities);
            if (abilities.length > 0) {
                 ctx.font = 'bold 18px arial';
                 ctx.fillStyle = UI_GREEN;
                 ctx.fillText('Abilities:', cardX + cardWidth / 2, cardY + 150);
                 ctx.font = '16px arial';
                 ctx.fillStyle = WHITE;
                 for(let k=0; k < abilities.length; k++){
                     ctx.fillText(`[${abilities[k].key_name}] ${abilities[k].name}: ${abilities[k].desc}`, cardX + cardWidth / 2, cardY + 180 + (k*20));
                 }
            }
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
        const allCells = [...this.playerCells, ...this.bots, ...this.zombies];
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
            if (cell instanceof PlayerCell) cellColor = this.playerClass === 'Necromancer' ? NECROMANCER_COLOR : MAGE_COLOR;
            if (cell instanceof ZombieBot) cellColor = ZOMBIE_COLOR;
            
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
        
        this.zombies.forEach(bot => {
            const dotX = mapX + (bot.x / WORLD_WIDTH) * mapWidth;
            const dotY = mapY + (bot.y / WORLD_HEIGHT) * mapHeight;
            ctx.beginPath();
            ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
            ctx.fillStyle = 'purple';
            ctx.fill();
        });

        if (this.playerCells && this.playerCells.length > 0) {
            const playerCenterX = this.playerCells.reduce((sum, c) => sum + c.x, 0) / this.playerCells.length;
            const playerCenterY = this.playerCells.reduce((sum, c) => sum + c.y, 0) / this.playerCells.length;
            const dotX = mapX + (playerCenterX / WORLD_WIDTH) * mapWidth;
            const dotY = mapY + (playerCenterY / WORLD_HEIGHT) * mapHeight;
            ctx.beginPath();
            ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
            ctx.fillStyle = this.playerClass === 'Necromancer' ? NECROMANCER_COLOR : MAGE_COLOR;
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
