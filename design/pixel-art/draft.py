"""Original, editable pixel-art concept assets. SVG sources + nearest-neighbour PNG previews.

Run: python3 design/pixel-art/draft.py
One drawing unit equals one pixel. No reference-image pixels are copied.
"""
from pathlib import Path
from html import escape
from PIL import Image, ImageDraw
from characters_v4 import draw_character, draw_studies

OUT = Path(__file__).resolve().parent
INK = '#10162b'
WOOD = '#b78660'
WOOD_LIGHT = '#d5aa7a'
WOOD_DARK = '#826047'
CREAM = '#f8eddb'

# SafeSpace's midnight / neon palette, applied only to the environment.
# Skin and hair colours are preserved independently in character().
NEON = {
    '#c8bbd7':'#0a0e1a', '#826047':'#263451', '#d5aa7a':'#596a8f',
    '#f2e8d8':'#364969', '#eee3d1':'#19243e', '#fcf4e4':'#55718e',
    '#e8dac9':'#22314e', '#b78660':'#2c3c59', '#8b684e':'#19273f',
    '#d3aa7d':'#465a7a', '#967354':'#1b2b45', '#bf926b':'#344968',
    '#cea077':'#405573', '#c8b8a8':'#111b30', '#aea9ca':'#373b71',
    '#aaa6ce':'#383e79', '#c4c3d8':'#555a94', '#999bad':'#262d58',
    '#fae4b0':'#ffe69b', '#d5a6bf':'#80569f', '#ecc1d4':'#b183d0',
    '#b984a3':'#573873', '#f4cddd':'#dfa1ed', '#597356':'#2b8d84',
    '#4f6c50':'#276b69', '#95ad74':'#7ce5b3', '#a5bd81':'#9aefbc',
    '#83a16a':'#4ecdc4', '#dfb37d':'#9b7bb9', '#bd855d':'#685981',
    '#d7a374':'#a98ec7', '#b5c8ba':'#4ecdc4', '#8fa99b':'#298f99',
    '#f3dfa5':'#ffe66d', '#a67e5c':'#354460', '#b58c65':'#415271',
    '#efd697':'#ffe66d', '#98745c':'#132038', '#715747':'#172338',
    '#abc4b5':'#4ecdc4', '#caa8c7':'#ba8cf3', '#e6c482':'#ffe66d',
    '#86aaa9':'#66a7db', '#d3b7cf':'#f68ecb', '#ddd4b3':'#acbbdd',
    '#9dbbc5':'#7bbbca', '#d4ae77':'#a78453', '#ebd4a7':'#ffe69b',
    '#c6a47f':'#435673', '#cda7bc':'#9566b2', '#c9b3a8':'#8578a5',
    '#9c785f':'#17243c', '#f8eddb':'#bdd7e7', '#fff7e7':'#dcf7fa',
    '#e1cfb9':'#78929f', '#f8f0e0':'#d7e9ed', '#b5a295':'#5e788f',
    '#fff8ed':'#f1ffff', '#e0d4c2':'#a1bac6', '#91b5ad':'#338f9a',
    '#b3d0bc':'#7ce5d7', '#648c89':'#236470', '#d9d9bc':'#64bdbb',
    '#d2e1ca':'#a2f9d8', '#e8cb8f':'#ffe66d', '#f3d4c7':'#ffc8ee',
    '#e3b8b9':'#d07bc2', '#a47d60':'#17243c', '#aaa8b2':'#8495af',
    '#646979':'#204d61', '#838999':'#4ecdc4', '#bcb7be':'#b2c5d5',
    '#d3b3c8':'#8d75c8', '#a7bbbd':'#638bc6', '#839d9d':'#3a527f',
    '#f9dfaa':'#ffe66d', '#a88467':'#19233d', '#d2abc2':'#8459a3',
    '#a77894':'#c184f3', '#efd0da':'#bb87d9', '#d9b0c4':'#583d79',
    '#fff0df':'#dbb3f6', '#e9c9d5':'#986db3', '#b98d95':'#422d63',
    '#e4d6b7':'#d9dfee', '#83a7a4':'#4ecdc4', '#b489a3':'#372847',
    '#c299af':'#48305e', '#f4ebdf':'#111a2e', '#d7c6b4':'#25334c',
}


class Art:
    def __init__(self, w, h, title):
        self.w, self.h, self.title = w, h, title
        self.image = Image.new('RGBA', (w, h))
        self.draw = ImageDraw.Draw(self.image)
        self.parts = []
        self.palette = NEON

    def rect(self, x, y, w, h, color):
        if w <= 0 or h <= 0:
            return
        color = self.palette.get(color, color)
        self.draw.rectangle((x, y, x+w-1, y+h-1), fill=color)
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{color}"/>')

    def box(self, x, y, w, h, fill, edge=INK):
        self.rect(x, y, w, h, edge)
        self.rect(x+1, y+1, w-2, h-2, fill)

    def save(self, name, scale=4):
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}" shape-rendering="crispEdges" role="img"><title>{escape(self.title)}</title>' + ''.join(self.parts) + '</svg>\n'
        (OUT / f'{name}.svg').write_text(svg)
        self.image.resize((self.w*scale, self.h*scale), Image.Resampling.NEAREST).save(OUT / f'{name}.png')


def plant(a, x, y, s=1):
    def r(xx, yy, w, h, c): a.rect(x+xx*s, y+yy*s, w*s, h*s, c)
    r(6, 4, 1, 13, '#597356')
    r(3, 1, 3, 6, '#4f6c50'); r(4, 1, 1, 4, '#95ad74')
    r(8, 5, 4, 5, '#4f6c50'); r(8, 5, 3, 2, '#a5bd81')
    r(0, 7, 5, 4, '#4f6c50'); r(1, 7, 3, 2, '#83a16a')
    r(2, 13, 11, 3, INK); r(3, 16, 9, 7, INK)
    r(3, 14, 9, 2, '#dfb37d'); r(4, 16, 7, 6, '#bd855d'); r(4, 16, 2, 5, '#d7a374')


def window(a, x, y, w=34, h=36):
    a.rect(x+2, y+h, w, 3, '#c8b8a8')
    a.box(x, y, w, h, WOOD_DARK)
    a.rect(x+1,y+1,w-2,2,WOOD_LIGHT)
    a.box(x+3,y+4,w-6,h-8,'#aea9ca')
    a.rect(x+5,y+6,w-10,10,'#aaa6ce')
    a.rect(x+5,y+16,w-10,h-22,'#c4c3d8')
    for bx,bh in [(5,5),(10,9),(16,7),(23,11)]:
        a.rect(x+bx,y+h-5-bh,4,bh,'#999bad')
    a.rect(x+w-12,y+8,5,5,'#fae4b0')
    a.rect(x+w//2-1,y+3,3,h-6,WOOD_DARK)
    a.rect(x+w//2-1,y+3,1,h-6,WOOD_LIGHT)
    a.rect(x+3,y+18,w-6,3,WOOD_DARK)
    a.rect(x+3,y+18,w-6,1,WOOD_LIGHT)
    a.rect(x-2,y+h-2,w+4,3,WOOD_DARK)
    a.rect(x-1,y+h-2,w+2,1,WOOD_LIGHT)


def curtains(a,x,y,w=46,h=38):
    a.rect(x-2,y-3,w+4,2,WOOD_DARK)
    for xx in (x,x+w-11):
        a.box(xx,y,11,h,'#d5a6bf')
        a.rect(xx+2,y+1,3,h-3,'#ecc1d4')
        a.rect(xx+8,y+1,1,h-3,'#b984a3')
        a.rect(xx+1,y+h-4,9,1,'#f4cddd')


def books(a,x,y,colors):
    heights=[10,13,9,12,8]
    for i,color in enumerate(colors):
        h=heights[i%5]
        a.box(x+i*4,y-h,4,h,color)
        a.rect(x+i*4+1,y-h+2,2,1,CREAM)


def character(a,x,y,scale=1,skin='#e9b58b',shade='#cb8e69',hair='#594039',hairlight='#9a6950',shirt='#299e97',shirtlight='#63debd',pants='#4d567c',style='short'):
    previous_palette = a.palette
    a.palette = {}
    def r(xx,yy,w,h,c): a.rect(x+xx*scale,y+yy*scale,w*scale,h*scale,c)
    # Twenty-two by twenty-eight grid, with a generous head and short body.
    # All details remain aligned to that grid, including outlines and highlights.
    if style == 'bob':
        r(3,4,16,14,INK);r(2,7,18,8,INK)
        r(3,7,17,7,hair);r(4,4,14,12,hair)
    elif style == 'curls':
        for xx,yy in [(5,1),(10,0),(14,2),(2,5),(17,6),(3,10)]:
            r(xx,yy,5,5,INK);r(xx+1,yy+1,3,3,hair)
    # Skull silhouette, ears and face plane.
    r(6,1,10,1,INK);r(4,2,14,2,INK);r(3,4,16,8,INK)
    r(4,11,14,3,INK);r(6,14,10,2,INK)
    r(4,7,14,5,shade);r(5,6,12,7,skin);r(7,13,8,2,shade)
    r(5,8,1,3,'#f4cea2')
    # Eyes: small dark sockets, clean cream highlights, looking forward.
    r(8,8,2,4,INK);r(13,8,2,4,INK)
    r(8,8,1,2,CREAM);r(13,8,1,2,CREAM)
    r(11,12,1,1,shade)
    # Sculpted hairstyle: three tones, asymmetrical swept fringe.
    r(6,2,9,1,hairlight);r(4,3,13,3,hair);r(3,6,3,5,hair)
    r(5,3,6,2,hairlight);r(4,5,5,2,hairlight);r(5,7,2,1,hairlight)
    r(12,3,5,2,hairlight);r(16,5,2,3,hair)
    r(7,2,3,1,'#ba8a64' if style != 'silver' else '#eee8d9')
    r(10,3,2,2,hair);r(8,6,6,1,hair)
    if style == 'bob':
        r(3,8,2,7,hair);r(17,7,2,8,hair)
        r(3,8,1,5,hairlight);r(17,8,1,4,hairlight)
    elif style == 'curls':
        for xx,yy in [(5,2),(10,1),(14,3),(3,5),(16,5)]:
            r(xx,yy,3,2,hairlight)
    # Relaxed sleeves, skin-coloured hands, and a simple shirt.
    r(5,15,13,1,INK);r(4,16,15,6,INK);r(3,18,17,3,INK)
    r(5,16,13,5,shirt);r(6,16,10,1,shirtlight)
    r(9,15,5,2,skin);r(10,17,3,1,shirtlight)
    r(4,19,2,2,skin);r(17,19,2,2,skin)
    r(5,17,2,2,shirtlight);r(15,17,2,3,shirt)
    r(7,18,9,5,shirt);r(7,18,2,4,shirtlight)
    r(13,19,2,2,shirtlight)
    # Trousers and separated shoes: compact, but recognisably human.
    r(6,22,12,5,INK);r(7,22,10,3,pants)
    r(7,24,4,2,pants);r(13,24,4,2,pants)
    r(11,24,2,3,INK)
    r(6,26,5,2,INK);r(13,26,5,2,INK)
    r(7,26,3,1,'#ddd5ca');r(14,26,3,1,'#ddd5ca')
    a.palette = previous_palette


def room():
    a=Art(288,198,'SafeSpace original neon pixel room concept with navy furniture, mint and violet accents, and a human pixel character')
    a.rect(0,0,288,198,'#c8bbd7')
    a.box(5,5,278,188,WOOD_DARK)
    a.rect(7,7,274,184,WOOD_LIGHT)
    a.box(10,10,268,180,'#f2e8d8')
    a.rect(12,12,264,78,'#eee3d1')
    a.rect(12,12,264,2,'#fcf4e4')
    # Sparse wallpaper flecks, painted on a single pixel grid.
    for yy in range(24,83,15):
        for xx in range(20,270,20):
            a.rect(xx,yy,1,2,'#e8dac9')
    # Staggered oak floorboards.
    a.rect(12,88,264,100,WOOD)
    for row,yy in enumerate(range(88,188,12)):
        a.rect(12,yy,264,1,'#8b684e')
        a.rect(12,yy+1,264,2,'#d3aa7d')
        for xx in range(-26 if row%2 else 12,276,48):
            if xx>12: a.rect(xx,yy,1,min(12,188-yy),'#967354')
            gx=max(13,xx+7)
            if gx+17<276 and yy+8<188:
                a.rect(gx,yy+8,17,1,'#bf926b')
                a.rect(gx+4,yy+6,6,1,'#cea077')
    a.rect(12,84,264,5,WOOD_DARK);a.rect(12,85,264,1,WOOD_LIGHT)
    # Window and curtains over the bed.
    window(a,28,31,40,38);curtains(a,25,30,46,41)
    # Wall shelf with a potted plant and framed landscape.
    a.box(81,29,34,4,WOOD);a.rect(82,30,32,1,WOOD_LIGHT)
    # Compact shelf plant stays inside the room's upper border.
    a.rect(87,17,1,8,'#597356')
    a.rect(84,16,3,4,'#83a16a');a.rect(89,18,3,3,'#a5bd81')
    a.box(84,23,9,6,'#bd855d');a.rect(85,24,7,1,'#dfb37d')
    a.box(100,17,11,12,WOOD_DARK);a.rect(102,19,7,8,'#b5c8ba')
    a.rect(102,23,7,4,'#8fa99b');a.rect(107,20,2,2,'#f3dfa5')
    # Door with recessed panels and brass handle.
    a.box(129,40,34,51,WOOD_DARK)
    a.rect(130,41,32,2,WOOD_LIGHT)
    a.box(132,44,28,45,'#a67e5c',WOOD_DARK)
    a.box(135,47,22,21,'#b58c65',WOOD_DARK)
    a.box(135,71,22,14,'#b58c65',WOOD_DARK)
    a.rect(153,67,3,2,'#efd697')
    # Bookcase with tiny ornaments and varied spines.
    a.rect(80,119,41,4,'#98745c')
    a.box(80,53,39,67,WOOD_DARK)
    a.rect(81,54,37,3,WOOD_LIGHT)
    for yy in (59,78,98):
        a.box(83,yy,33,16,'#715747',WOOD_DARK)
    books(a,86,73,['#abc4b5','#caa8c7','#e6c482','#86aaa9'])
    books(a,101,92,['#d3b7cf','#ddd4b3','#9dbbc5'])
    a.box(87,83,9,9,'#d4ae77');a.rect(89,85,5,5,'#ebd4a7')
    a.box(86,101,13,11,'#c6a47f');a.rect(90,104,5,2,WOOD_DARK)
    a.box(101,101,12,11,'#c6a47f');a.rect(104,104,5,2,WOOD_DARK)
    a.rect(81,75,37,3,WOOD);a.rect(81,95,37,3,WOOD)
    a.rect(81,114,37,3,WOOD_LIGHT)
    # Clock: stepped round outline.
    for xx,yy,ww,hh,c in [(94,37,13,2,INK),(91,39,19,3,INK),(89,42,23,13,INK),(91,55,19,3,INK),(94,58,13,2,INK),(94,39,13,19,'#cda7bc'),(91,42,19,13,'#cda7bc'),(94,42,13,13,CREAM)]:a.rect(xx,yy,ww,hh,c)
    a.rect(100,44,1,6,WOOD_DARK);a.rect(100,49,4,1,WOOD_DARK)
    for xx,yy in [(100,42),(100,53),(94,48),(106,48)]: a.rect(xx,yy,1,1,'#c9b3a8')
    # Bed, top plane and footboard.
    a.rect(26,151,50,4,'#9c785f')
    a.box(25,84,49,67,WOOD_DARK)
    a.box(28,81,43,15,CREAM)
    a.rect(29,82,41,2,'#fff7e7')
    a.box(29,94,41,52,'#e1cfb9')
    a.box(33,96,33,13,'#f8f0e0','#b5a295')
    a.rect(35,97,29,2,'#fff8ed');a.rect(36,106,27,2,'#e0d4c2')
    a.box(28,110,44,32,'#91b5ad')
    a.rect(29,111,42,3,'#b3d0bc');a.rect(29,139,42,2,'#648c89')
    a.rect(29,141,42,4,'#d9d9bc')
    for xx,yy in [(36,117),(57,117),(46,129)]:
        a.rect(xx,yy,3,7,'#d2e1ca');a.rect(xx-2,yy+2,7,3,'#d2e1ca')
    a.rect(28,147,44,3,WOOD_LIGHT)
    # Beside the bed: cabinet and reading lamp.
    a.box(13,102,12,23,WOOD_DARK);a.rect(14,104,10,2,WOOD_LIGHT)
    a.rect(15,109,8,11,WOOD);a.rect(18,112,3,1,'#e8cb8f')
    a.rect(17,91,2,11,WOOD_DARK);a.rect(14,101,9,2,WOOD_DARK)
    a.rect(15,83,7,2,INK);a.rect(14,85,9,3,INK);a.rect(13,88,11,4,INK)
    a.rect(16,84,5,2,'#f3d4c7');a.rect(15,86,7,3,'#e3b8b9');a.rect(14,89,9,2,'#f3d4c7')
    # A second window and compact desk with a laptop.
    window(a,213,28,38,37)
    a.rect(194,125,66,4,'#a47d60')
    a.box(194,93,66,8,WOOD);a.rect(195,94,64,2,WOOD_LIGHT)
    a.box(197,100,4,26,WOOD);a.box(253,100,4,26,WOOD)
    a.box(236,101,17,17,WOOD);a.rect(238,103,13,1,WOOD_LIGHT);a.rect(242,109,4,1,WOOD_DARK)
    a.box(202,77,24,17,'#aaa8b2')
    a.box(204,79,20,12,'#646979');a.rect(205,80,18,2,'#838999')
    a.rect(200,93,28,3,INK);a.rect(202,93,24,2,'#bcb7be')
    plant(a,240,71)
    # Framed picture beside the desk, with a pixel landscape.
    a.box(176,37,18,23,WOOD_DARK);a.rect(177,38,16,1,WOOD_LIGHT)
    a.rect(179,40,12,17,'#d3b3c8');a.rect(179,49,12,8,'#a7bbbd')
    a.rect(179,52,5,5,'#839d9d');a.rect(183,50,4,7,'#839d9d');a.rect(187,53,4,4,'#839d9d')
    a.rect(187,42,3,3,'#f9dfaa')
    # A stool, in front of the desk.
    a.box(211,117,20,6,WOOD);a.rect(212,118,18,2,WOOD_LIGHT)
    a.box(213,123,3,12,WOOD);a.box(227,123,3,12,WOOD)
    # Large rug, with a restrained woven border.
    a.rect(101,138,106,40,'#a88467')
    a.box(100,135,106,40,'#d2abc2','#a77894')
    a.rect(102,137,102,36,'#efd0da')
    a.rect(104,139,98,32,'#d9b0c4')
    for yy in (138,171):
        for xx in range(104,201,6): a.rect(xx,yy,3,1,'#fff0df')
    for xx in (99,206):
        for yy in range(138,174,4):a.rect(xx,yy,1,2,'#e9c9d5')
    # Small tray table at the rug edge, leaving a clear character silhouette.
    a.rect(112,150,25,3,'#b98d95')
    a.box(110,139,27,8,WOOD_DARK);a.rect(111,140,25,3,WOOD_LIGHT)
    a.box(113,147,3,10,WOOD);a.box(132,147,3,10,WOOD)
    a.box(116,134,7,6,'#e4d6b7');a.rect(123,135,2,3,'#e4d6b7')
    a.rect(127,135,6,4,'#83a7a4');a.rect(127,135,6,1,CREAM)
    # Human avatar casts a small stepped contact shadow.
    a.rect(163,165,22,2,'#b489a3');a.rect(166,167,16,1,'#c299af')
    draw_character(a,160,134)
    # A plant gives the open corner a vertical counterpoint.
    plant(a,245,140,2)
    # Restrained neon strips: a stepped halo, a saturated edge, a pale core.
    # Keep the floor and furniture planes dark enough for the sprite to read.
    a.rect(13,13,262,3,'#23405b')
    a.rect(14,13,260,1,'#4ecdc4')
    a.rect(14,14,260,1,'#346e7c')
    a.rect(29,151,41,3,'#255766')
    a.rect(30,151,39,1,'#4ecdc4')
    a.rect(196,98,62,1,'#7486c9')
    a.rect(197,98,60,1,'#a497ff')
    # A tiny warm pixel light preserves the welcoming room atmosphere.
    a.rect(15,90,7,1,'#ffe6a9')
    a.save('neon-room-concept-v4')


def characters():
    a=Art(240,69,'Four original human pixel character studies: swept hair, bob, curls and silver hair')
    a.rect(0,0,240,69,'#f4ebdf')
    for xx in [21,79,137,195]:
        a.rect(xx,60,37,3,'#d7c6b4')
    character(a,16,6,2)
    character(a,74,6,2,skin='#e6b18e',shade='#c38b71',hair='#463545',hairlight='#776071',shirt='#c34e91',shirtlight='#f893ca',pants='#5b536b',style='bob')
    character(a,132,6,2,skin='#b97c59',shade='#955e4b',hair='#382d35',hairlight='#634348',shirt='#c79c38',shirtlight='#ffe66d',pants='#4a6371',style='curls')
    character(a,190,6,2,skin='#efc6a3',shade='#d0a280',hair='#8f8c9c',hairlight='#c4bfca',shirt='#7758b6',shirtlight='#b69bff',pants='#67586b',style='silver')
    a.save('neon-character-studies')


if __name__ == '__main__':
    room()
    draw_studies(Art)
