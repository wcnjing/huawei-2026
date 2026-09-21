"""Editable pixel furniture studies for review only; not imported by the app."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from html import escape

OUT=Path(__file__).resolve().parent
INK='#0a1021'; EDGE='#42516f'; DARK='#1b2942'; PANEL='#33435f'
MINT='#57d8bf'; MINT_L='#a1f2d7'; MINT_D='#247d83'
PINK='#ec77be'; PINK_L='#ffbddf'; PINK_D='#974780'
PURPLE='#9873d8'; PURPLE_L='#d5b6ff'; PURPLE_D='#55427f'
GOLD='#f0cb69'; GOLD_L='#fff0b5'; GOLD_D='#987845'
WHITE='#d7e6ed'; BLUE='#60bdda'

class Sprite:
    def __init__(self):
        self.image=Image.new('RGBA',(56,48)); self.d=ImageDraw.Draw(self.image); self.svg=[]
    def r(self,x,y,w,h,c):
        self.d.rectangle((x,y,x+w-1,y+h-1),fill=c)
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c}"/>')
    def box(self,x,y,w,h,c,edge=INK):
        self.r(x,y,w,h,edge);self.r(x+1,y+1,w-2,h-2,c)
    def poly(self,points,c):
        self.d.polygon(points,fill=c)
        self.svg.append(f'<polygon points="{" ".join(f"{x},{y}" for x,y in points)}" fill="{c}"/>')
    def shadow(self,x=7,y=42,w=42):
        self.r(x,y,w,2,'#0b1223');self.r(x+3,y+2,w-6,1,'#0b1223')
    def save(self,name):
        self.image.save(OUT/f'{name}.png')
        (OUT/f'{name}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 48" shape-rendering="crispEdges"><title>{escape(name)}</title>{"".join(self.svg)}</svg>\n')

def sofa(s):
    s.shadow();s.box(10,17,36,17,MINT_D);s.r(12,18,32,2,MINT_L)
    for x in (12,28):
        s.box(x,20,16,11,MINT);s.r(x+1,21,13,1,MINT_L)
        s.box(x,31,16,6,MINT);s.r(x+1,32,13,1,MINT_L)
    s.box(6,27,7,12,MINT_D);s.r(7,28,5,2,MINT)
    s.box(43,27,7,12,MINT_D);s.r(44,28,5,2,MINT)
    s.r(10,39,4,4,GOLD_D);s.r(42,39,4,4,GOLD_D)
    s.box(15,23,8,7,PURPLE);s.r(16,24,6,1,PURPLE_L)
    s.r(8,37,40,2,MINT_D)

def bed(s):
    s.shadow(9,44,39);s.box(12,7,33,35,PANEL);s.r(13,8,31,2,EDGE)
    s.box(15,11,27,10,WHITE);s.box(18,13,21,6,'#f1f4eb');s.r(19,17,19,1,'#adbac7')
    s.box(11,21,35,19,PURPLE);s.r(12,22,33,3,PURPLE_L);s.r(12,36,33,3,PURPLE_D)
    for x,y in [(20,28),(35,28),(27,33)]:
        s.r(x,y,1,3,PURPLE_L);s.r(x-1,y+1,3,1,PURPLE_L)
    s.box(10,40,37,4,PANEL);s.r(11,41,35,1,EDGE);s.r(12,44,4,2,INK);s.r(41,44,4,2,INK)

def chair(s):
    s.shadow(15,43,27);s.box(19,9,20,19,PANEL);s.box(21,11,16,14,PINK_D);s.r(22,12,14,2,PINK)
    s.r(21,28,3,15,EDGE);s.r(35,28,3,15,EDGE)
    s.box(16,27,25,7,PINK);s.r(17,28,23,2,PINK_L);s.r(17,33,3,10,PANEL);s.r(37,33,3,10,PANEL)

def table(s):
    s.shadow();s.box(9,30,4,13,EDGE);s.box(43,30,4,13,EDGE)
    s.box(5,22,46,10,PANEL);s.r(7,23,42,3,EDGE);s.r(7,26,42,1,MINT)
    s.box(13,17,10,5,PURPLE);s.r(14,17,8,1,PURPLE_L);s.r(13,20,10,1,WHITE)
    s.box(35,16,6,6,WHITE);s.box(40,17,4,4,WHITE);s.r(37,17,2,1,GOLD_D)

def chandelier(s):
    s.r(27,2,2,15,GOLD_D);s.r(27,3,1,13,GOLD)
    s.box(23,16,10,4,GOLD);s.r(26,20,4,13,GOLD_D)
    s.r(12,27,32,3,GOLD_D);s.r(13,27,30,1,GOLD)
    for x,y in [(11,20),(26,31),(41,20)]:
        s.r(x+1,y-3,3,2,GOLD_L);s.box(x-3,y,11,6,GOLD);s.r(x-1,y+1,7,2,GOLD_L)
        s.r(x+1,y+6,3,5,BLUE);s.r(x+2,y+6,1,3,WHITE)

def walllight(s):
    s.box(25,12,8,24,PANEL);s.r(27,14,2,20,EDGE)
    s.r(29,27,11,3,GOLD_D);s.r(37,19,3,10,GOLD)
    s.poly([(32,9),(42,9),(47,20),(28,20)],INK)
    s.poly([(33,10),(41,10),(45,19),(30,19)],PINK)
    s.r(33,11,3,7,PINK_L);s.r(31,20,13,2,GOLD_L);s.r(36,22,4,2,GOLD)

def floorlamp(s):
    s.shadow(17,43,23);s.box(18,41,23,3,PANEL);s.r(28,18,3,23,EDGE);s.r(28,20,1,20,GOLD)
    s.poly([(22,7),(36,7),(42,20),(16,20)],INK)
    s.poly([(23,8),(35,8),(40,19),(18,19)],GOLD)
    s.r(23,9,3,8,GOLD_L);s.r(19,20,20,2,GOLD_D)

def window(s):
    s.box(10,7,36,33,EDGE);s.box(13,10,30,26,'#29355d')
    s.r(15,12,26,10,'#394a76');s.r(34,13,5,5,GOLD_L)
    for x,h in [(15,7),(21,11),(28,8),(35,13)]:
        s.r(x,36-h,5,h,'#182640');s.r(x+2,38-h,1,2,MINT)
    s.r(27,10,2,27,EDGE);s.r(13,24,30,2,EDGE);s.r(28,10,1,27,MINT)
    s.box(7,40,42,4,PANEL);s.r(8,41,40,1,EDGE)

def curtain(s):
    window(s);s.r(5,5,46,2,GOLD_D)
    for x in (7,39):
        s.box(x,7,10,32,PURPLE);s.r(x+2,8,2,27,PURPLE_L);s.r(x+7,8,1,30,PURPLE_D)
        s.r(x+1,26,8,2,GOLD);s.r(x+2,28,6,1,GOLD_D)

def door(s):
    s.box(15,3,28,42,EDGE);s.box(18,6,22,38,PANEL)
    s.box(21,9,16,19,'#274b5c');s.box(21,31,16,10,'#29374f')
    s.r(22,10,14,1,MINT);s.r(22,11,1,15,MINT_D)
    s.box(35,27,3,3,GOLD);s.r(14,44,30,2,EDGE)

def rug(s,round=False):
    s.shadow(5,37,47)
    if round:
        s.poly([(15,18),(41,18),(49,23),(53,28),(49,34),(41,38),(15,38),(6,34),(3,28),(6,23)],INK)
        s.poly([(15,19),(41,19),(48,24),(51,28),(48,33),(41,36),(15,36),(7,33),(5,28),(7,24)],PURPLE)
        s.poly([(17,23),(39,23),(46,28),(39,33),(17,33),(10,28)],PURPLE_L)
        s.poly([(18,25),(38,25),(42,28),(38,31),(18,31),(14,28)],PURPLE_D)
    else:
        s.box(5,20,46,18,PINK_D);s.box(7,22,42,14,PINK);s.box(10,25,36,8,PINK_D)
        for x in range(8,50,4):s.r(x,18,1,2,PINK_L);s.r(x,38,1,2,PINK_L)
        for x in (17,27,37):s.poly([(x,26),(x+3,29),(x,31),(x-3,29)],PINK_L)

def pot(s,x=21,y=32,c=PURPLE):
    s.box(x-2,y,18,4,c);s.box(x,y+4,14,9,c);s.r(x+2,y+5,2,6,PURPLE_L);s.r(x+11,y+4,2,8,PURPLE_D)

def plant(s):
    s.shadow(15,44,29);pot(s);s.r(27,13,2,20,MINT_D)
    for pts,c in [([(27,25),(19,23),(15,15),(21,14),(27,20)],MINT), ([(28,20),(32,12),(39,10),(40,16),(33,22)],MINT_L), ([(27,16),(23,10),(25,4),(29,6),(31,13)],MINT)]:s.poly(pts,INK);s.poly([(x,y+1) for x,y in pts[:-1]],c)
    s.r(20,17,1,5,MINT_D);s.r(33,15,1,5,MINT_D)

def cactus(s):
    s.shadow(16,44,26);pot(s,22,32,PINK_D)
    s.box(25,9,9,25,MINT_D);s.r(27,10,3,22,MINT);s.r(27,11,1,20,MINT_L)
    s.box(17,17,5,10,MINT_D);s.r(18,18,2,7,MINT);s.r(21,24,5,3,MINT_D)
    s.box(36,13,5,10,MINT_D);s.r(37,14,2,7,MINT);s.r(33,21,5,3,MINT_D)
    for x,y in [(27,14),(30,20),(28,26),(19,20),(38,17)]:s.r(x,y,1,1,WHITE)
    s.r(29,7,5,2,PINK);s.r(30,6,2,4,PINK_L)

def hanging(s):
    s.r(27,2,2,3,GOLD)
    for i in range(12):s.r(27-i,5+i,1,1,GOLD_D);s.r(28+i,5+i,1,1,GOLD_D)
    pot(s,21,21,EDGE)
    for x,y in [(18,17),(23,15),(29,17),(34,16),(37,21),(19,28),(17,34),(22,39),(35,32),(38,37)]:
        s.r(x,y,4,3,MINT_D);s.r(x,y,3,1,MINT)
    s.r(19,20,1,20,MINT_D);s.r(37,22,1,16,MINT_D)

def shelf(s):
    s.shadow(9,45,37);s.box(10,5,36,40,PANEL);s.r(11,6,34,2,EDGE)
    for y in (11,22,33):
        s.box(13,y,30,9,DARK)
        for i,c in enumerate([MINT,PURPLE,GOLD,PINK]):
            h=5+(i%2)*2;s.box(15+i*6,y+8-h,5,h,c);s.r(16+i*6,y+9-h,3,1,WHITE)
        s.r(11,y+9,34,2,EDGE)

def cabinet(s):
    s.shadow(9,44,38);s.box(10,15,37,28,PANEL);s.r(11,16,35,2,EDGE)
    for y in (20,30):s.box(13,y,31,10,EDGE);s.r(15,y+2,27,1,'#58647f');s.box(25,y+4,8,3,GOLD_D)
    s.r(13,43,3,3,INK);s.r(41,43,3,3,INK)

def computer(s):
    s.shadow();s.box(6,10,32,23,EDGE);s.box(9,13,26,16,'#152d43')
    s.r(10,14,24,2,MINT);s.r(11,19,10,1,BLUE);s.r(11,22,17,1,PURPLE_L);s.r(11,25,13,1,MINT_D)
    s.r(20,33,4,5,PANEL);s.box(15,37,14,3,EDGE)
    s.box(41,16,10,24,PANEL);s.r(43,19,6,1,PURPLE);s.box(43,23,6,7,DARK);s.r(45,25,2,3,PINK);s.r(45,35,2,2,MINT)
    s.box(7,41,30,5,PANEL)
    for x in range(9,35,3):s.r(x,42,2,1,MINT)
    s.box(41,42,5,4,EDGE)

def laptop(s):
    s.shadow(8,42,39);s.box(13,12,31,24,EDGE);s.box(16,15,25,18,'#18334b')
    s.r(17,16,23,2,BLUE);s.r(18,21,15,1,MINT);s.r(18,24,9,1,PURPLE_L);s.r(18,27,19,1,BLUE)
    s.poly([(13,36),(43,36),(48,42),(8,42)],INK);s.poly([(14,36),(42,36),(45,40),(11,40)],PANEL)
    for x in range(16,41,3):s.r(x,37,2,1,BLUE)
    s.r(24,39,10,1,EDGE)

def tv(s):
    s.shadow();s.box(4,10,48,28,EDGE);s.box(7,13,42,22,DARK)
    s.poly([(8,34),(8,27),(20,18),(32,31),(38,21),(48,30),(48,34)],PURPLE_D)
    s.poly([(8,34),(8,31),(22,22),(38,34)],PURPLE);s.r(38,16,5,5,PINK)
    s.r(12,38,3,5,PANEL);s.r(10,42,7,2,EDGE);s.r(41,38,3,5,PANEL);s.r(39,42,7,2,EDGE)

def basketball(s):
    s.shadow(11,43,35);s.box(10,5,35,18,WHITE);s.box(13,8,29,12,'#647f9b');s.box(22,11,12,9,WHITE)
    s.box(20,20,16,4,'#e78a57');s.r(28,24,3,18,EDGE);s.box(20,42,20,3,PANEL)
    for i in range(4):s.r(22+i,24+i*2,1,2,WHITE);s.r(33-i,24+i*2,1,2,WHITE)
    s.r(26,31,5,1,WHITE)
    s.poly([(8,33),(14,33),(18,37),(18,41),(14,45),(8,45),(4,41),(4,37)],INK)
    s.poly([(8,34),(14,34),(17,37),(17,41),(14,44),(8,44),(5,41),(5,37)],'#ec9759');s.r(10,34,1,11,GOLD_D);s.r(5,39,13,1,GOLD_D)

def weights(s):
    s.shadow();s.box(13,25,30,4,EDGE)
    for x in (8,14,37,43):s.box(x,19,5,16,PURPLE_D);s.r(x+1,20,2,13,PURPLE)
    s.r(20,26,16,1,WHITE)
    s.box(11,36,34,4,PANEL);s.r(12,37,32,1,EDGE);s.r(13,40,3,4,EDGE);s.r(40,40,3,4,EDGE)

def skateboard(s):
    s.shadow(8,41,40);s.poly([(7,29),(12,33),(44,33),(49,29),(52,30),(48,38),(9,38),(4,31)],INK)
    s.poly([(7,30),(12,34),(44,34),(49,30),(50,31),(46,36),(10,36),(6,31)],PINK)
    s.r(15,34,10,2,PURPLE_L);s.r(32,34,9,2,GOLD)
    for x in (14,38):s.box(x,38,6,6,EDGE);s.r(x+2,40,2,2,MINT)

def guitar(s):
    s.shadow(17,44,25);s.r(29,5,3,25,GOLD_D);s.box(27,2,7,6,EDGE)
    s.poly([(24,25),(31,25),(36,29),(35,34),(39,38),(37,43),(20,43),(17,38),(22,32),(21,28)],INK)
    s.poly([(25,26),(30,26),(34,29),(33,34),(37,38),(35,42),(22,42),(19,38),(24,32),(23,28)],GOLD)
    s.r(22,36,2,5,GOLD_L);s.box(26,30,7,7,GOLD_D);s.box(27,31,5,5,DARK)
    s.r(29,8,1,31,WHITE);s.r(25,39,9,2,GOLD_D)
    for y in (11,16,21):s.r(28,y,4,1,EDGE)

ITEMS=[
 ('Mint couch','Basic furniture',sofa),('Starlight bed','Basic furniture',bed),('Blush chair','Basic furniture',chair),('Coffee table','Basic furniture',table),
 ('Crystal chandelier','Lights',chandelier),('Wall sconce','Lights',walllight),('Reading lamp','Lights',floorlamp),
 ('City window','Windows & doors',window),('Curtained window','Windows & doors',curtain),('Neon-panel door','Windows & doors',door),
 ('Woven runner','Carpets',rug),('Orbit carpet','Carpets',lambda s:rug(s,True)),
 ('Leafy plant','Plants',plant),('Flowering cactus','Plants',cactus),('Hanging planter','Plants',hanging),
 ('Bookcase','Shelves & storage',shelf),('Drawer cabinet','Shelves & storage',cabinet),
 ('Desktop setup','Tech & entertainment',computer),('Laptop','Tech & entertainment',laptop),('Movie-night TV','Tech & entertainment',tv),
 ('Basketball hoop','Sports & hobbies',basketball),('Dumbbell rack','Sports & hobbies',weights),('Skateboard','Sports & hobbies',skateboard),('Acoustic guitar','Sports & hobbies',guitar),
]

def font(size):
    return ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',size)

def sheets():
    sprites=[]
    for i,(name,category,draw) in enumerate(ITEMS,1):
        s=Sprite();draw(s);s.save(f'{i:02d}-{name.lower().replace(" ","-")}');sprites.append(s)
    for page in range(2):
        im=Image.new('RGB',(864,796),'#0b1020');d=ImageDraw.Draw(im)
        d.text((24,18),'SAFESPACE / FURNITURE STUDIES',font=font(23),fill='#dcecf3')
        d.text((24,52),f'{page+1:02d} / NEON PIXEL COLLECTION · DRAFT FOR REVIEW',font=font(14),fill='#77cbbf')
        for j in range(12):
            idx=page*12+j;name,cat,_=ITEMS[idx];x=24+(j%4)*208;y=90+(j//4)*230
            d.rectangle((x,y,x+191,y+211),fill='#172238',outline='#31425c')
            d.text((x+12,y+10),f'{idx+1:02d}',font=font(13),fill='#849db7')
            tile=sprites[idx].image.resize((168,144),Image.Resampling.NEAREST)
            im.paste(tile,(x+12,y+19),tile)
            d.text((x+12,y+166),name,font=font(16),fill='#e0edf5')
            d.text((x+12,y+190),cat,font=font(12),fill='#9bafc6')
        im.save(OUT/f'furniture-sheet-{page+1}.png')

if __name__=='__main__': sheets()
