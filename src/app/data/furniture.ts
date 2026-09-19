import type { FurnitureItem } from "../types/store";

export const FURNITURE_STORE: FurnitureItem[] = [
  { id: "grandma-chair",   name: "ARMCHAIR",      sellValue: 80,  memberId: "grandma" },
  { id: "grandma-shelf",   name: "BOOKSHELF",     sellValue: 60,  memberId: "grandma" },
  { id: "grandma-lamp",    name: "TABLE LAMP",    sellValue: 55,  memberId: "grandma" },
  { id: "grandma-frame",   name: "PICTURE FRAME", sellValue: 45,  memberId: "grandma" },
  { id: "mum-plant",       name: "POT PLANT",     sellValue: 40,  memberId: "mum"     },
  { id: "mum-desk",        name: "WORK DESK",     sellValue: 90,  memberId: "mum"     },
  { id: "mum-laptop",      name: "LAPTOP",        sellValue: 110, memberId: "mum"     },
  { id: "mum-phone",       name: "PHONE",         sellValue: 35,  memberId: "mum"     },
  { id: "dad-tv",          name: "TV SET",        sellValue: 120, memberId: "dad"     },
  { id: "dad-couch",       name: "COUCH",         sellValue: 100, memberId: "dad"     },
  { id: "dad-cabinet",     name: "CABINET",       sellValue: 65,  memberId: "dad"     },
  { id: "dad-door",        name: "DOOR",          sellValue: 45,  memberId: "dad"     },
  { id: "dad-shower",      name: "SHOWER",        sellValue: 50,  memberId: "dad"     },
  { id: "kid-bed",         name: "BED",           sellValue: 70,  memberId: "kid"     },
  { id: "kid-toybox",      name: "TOY BOX",       sellValue: 30,  memberId: "kid"     },
  { id: "kid-teddy",       name: "TEDDY BEAR",    sellValue: 25,  memberId: "kid"     },
  { id: "kid-alarm",       name: "ALARM CLOCK",   sellValue: 20,  memberId: "kid"     },
];