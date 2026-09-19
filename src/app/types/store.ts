export interface FurnitureItem { 
    id: string; 
    name: string; 
    sellValue: number; 
    memberId: string 
}

export interface ShopItem {
    id: string;
    name: string;
    cost: number;
    color: string;
    // Which shop-item pixel-art to render; distinct namespace from FurnitureIcon.
    art: 
        | "sofa" 
        | "lamp" 
        | "plant" 
        | "tv" 
        | "rug" 
        | "bookshelf" 
        | "bed" 
        | "window";
}