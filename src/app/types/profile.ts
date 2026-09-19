export interface AvatarConfig { 
    color: string; 
    glow: string; 
    hat: string; 
    eyes: string; 
    outfit: string; 
}

export interface PlayerProfile { 
    name: string; 
    avatar: AvatarConfig; 
}

export interface ContactInfo { 
    name: string; 
    phone: string; 
    email: string; 
}

export interface NameUpdateResult { 
    ok: boolean; 
    name?: string; 
    error?: string 
}
