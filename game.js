class CoalescingMass extends TargetedMass {
    constructor(x, y, mass, color, targetCell) {
        super(x, y, mass, color, targetCell);
        // FIX: Gives the chunks a 30-frame (0.5 second) cooldown before the player can eat them.
        this.playerEatCooldown = 30; 
    }
    update() {
        // FIX: Adds the code to count down the eat cooldown each frame.
        if (this.playerEatCooldown > 0) {
            this.playerEatCooldown--;
        }

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
