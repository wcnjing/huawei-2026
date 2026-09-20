"""Compact 24x36 original pixel sprites; centred eyes and tapered silhouettes."""
from characters_v2 import PALETTES


def draw_character(a, x, y, scale=1, index=0):
    p = PALETTES[index]
    sh, skin, ss = p['skin']
    hd, hair, hh, shine = p['hair']
    cd, cloth, ch = p['cloth']
    pd, pants, ph = p['trousers']
    ink = '#19192b'
    old_palette = a.palette
    a.palette = {}

    def r(xx, yy, w, h, c):
        a.rect(x+xx*scale,y+yy*scale,w*scale,h*scale,c)

    # Back hair: follows the skull before separating into locks.
    if p['style'] == 'long':
        r(5,4,14,13,hd); r(4,7,3,13,hd); r(17,7,3,15,hd)
        r(5,7,2,12,hair); r(18,8,1,12,hair)
        r(5,9,1,8,hh); r(17,13,1,7,hh)
    elif p['style'] == 'ponytail':
        r(18,4,3,3,hd); r(20,7,3,7,hd); r(19,13,3,4,hd)
        r(20,7,2,6,hair); r(20,8,1,3,hh); r(19,14,2,2,hair)
        r(18,6,2,1,ch)

    # Shorter legs. The hip joins the torso, and each leg has a knee contour.
    r(6,25,12,4,ink); r(6,28,5,6,ink); r(13,28,5,6,ink)
    r(7,26,10,2,pants); r(7,28,3,5,pants); r(14,28,3,5,pants)
    r(7,27,2,2,ph); r(15,27,2,2,ph)
    r(7,29,1,3,ph); r(14,30,1,2,ph)
    r(9,30,1,3,pd); r(16,30,1,3,pd); r(11,27,2,2,pd)
    r(7,33,3,1,pd); r(14,33,3,1,pd)
    r(5,34,6,2,ink); r(13,34,6,2,ink)
    r(6,33,4,2,'#abb5bd'); r(14,33,4,2,'#abb5bd')
    r(6,33,3,1,'#e0e2d6'); r(14,33,3,1,'#e0e2d6')

    # Sloped shoulders, sleeves and rounded hands; no detached arm blocks.
    r(7,15,10,1,ink); r(5,16,14,2,ink)
    r(4,18,16,3,ink); r(3,21,5,4,ink); r(17,21,4,4,ink)
    r(4,24,4,3,ink); r(17,24,3,3,ink)
    r(6,16,12,2,cloth); r(5,18,3,4,cloth); r(17,18,2,4,cloth)
    r(4,22,3,2,cloth); r(18,22,2,2,cloth)
    r(5,18,1,3,ch); r(4,22,1,2,ch)
    r(6,21,1,3,cd); r(18,19,1,2,cd); r(19,22,1,2,cd)
    r(4,24,3,2,skin); r(17,24,3,2,skin)
    r(4,24,2,1,sh); r(17,24,2,1,sh)
    r(5,26,2,1,ss); r(18,26,1,1,ss)
    # Broad chest narrows at the waist.
    r(7,17,10,8,cloth); r(6,19,12,4,cloth)
    r(7,24,10,2,cloth); r(7,26,10,1,cd)
    r(7,18,2,4,ch); r(8,22,1,3,ch)
    r(16,18,1,4,cd); r(15,23,2,3,cd)
    r(10,14,4,3,ss); r(10,14,3,2,skin)

    outfit=p['outfit']
    if outfit=='jacket':
        # A collared button shirt with small pockets; detail stays subordinate.
        r(8,16,2,1,ch); r(9,17,2,1,ch)
        r(14,16,2,1,ch); r(13,17,2,1,ch)
        r(11,18,2,8,cd); r(11,18,1,8,cloth)
        for yy in (19,22,25): r(12,yy,1,1,'#eed78e')
        r(8,20,2,1,cd); r(14,20,2,1,cd)
        r(8,21,2,1,cloth); r(14,21,2,1,cloth)
    elif outfit=='cardigan':
        r(10,17,4,8,'#e4c8bc'); r(11,18,2,6,'#f4e0c9')
        r(9,17,1,8,ch); r(14,18,1,7,cd)
        r(10,24,4,2,'#796078'); r(8,23,1,1,ch)
    elif outfit=='hoodie':
        r(8,16,2,2,cd); r(14,16,2,2,cd)
        r(9,18,1,3,ch); r(14,18,1,3,ch)
        r(9,23,6,2,cd); r(10,23,4,1,cloth)
        r(10,25,4,1,ch)
    elif outfit=='vest':
        r(5,18,2,5,'#b4bec0'); r(18,18,1,5,'#d5d6c4')
        r(9,16,2,2,'#e0e2d6'); r(13,16,2,2,'#e0e2d6')
        r(11,18,2,1,'#b4bec0'); r(11,19,2,7,cd)
        for yy in (21,24): r(12,yy,1,1,ch)
    else:
        r(9,16,2,1,cd); r(13,16,2,1,cd)
        r(11,17,2,9,cd); r(11,18,1,7,'#e9bf9d')
        r(14,19,2,1,ch); r(8,23,2,1,cd)

    # Curved cheek and jaw silhouette, continuous into the neck.
    r(7,3,10,1,hd); r(5,4,14,7,hd)
    r(6,10,12,3,ss); r(7,12,10,1,ss); r(8,13,8,1,ss)
    r(7,5,10,7,skin); r(6,8,1,3,skin)
    r(8,12,8,1,skin); r(9,13,6,1,skin); r(10,14,4,1,skin)
    r(7,7,2,3,sh); r(9,6,6,2,sh); r(9,12,3,1,sh)
    r(16,7,1,5,ss); r(15,12,1,1,ss)
    r(5,9,1,2,skin); r(18,9,1,2,ss)
    # Centred, small eyes. Dark upper lids; no oversized white rectangles.
    for ex in (8,13):
        r(ex,8,3,1,hd)
        r(ex,9,1,2,'#f5dfb3')
        r(ex+1,9,1,2,'#214e46')
        r(ex+2,9,1,2,'#61a77b')
        r(ex+1,9,1,1,ink)
    r(11,11,1,1,ss)
    r(11,13,2,1,'#ba8065' if index!=2 else '#945d48')

    # Hair: small stepped clusters rather than horizontal slabs.
    style=p['style']
    if style in ('swept','silver','ponytail'):
        r(8,1,7,1,hd); r(6,2,11,1,hd); r(5,3,13,2,hd)
        r(4,5,5,2,hd); r(6,3,10,2,hair)
        r(8,2,6,1,hh); r(7,3,3,1,hh); r(5,5,4,1,hh)
        r(10,3,4,1,shine); r(14,4,3,1,hh)
        r(8,4,5,1,hair); r(7,5,4,1,hair)
        r(6,6,3,1,hair); r(6,7,1,2,hair)
        r(15,5,3,1,hair); r(17,6,1,3,hair)
        r(16,5,1,1,hh); r(7,5,1,1,shine)
    elif style=='long':
        r(8,1,7,1,hd); r(6,2,11,2,hd); r(5,4,14,3,hd)
        r(7,2,8,1,hh); r(6,3,11,2,hair)
        r(6,4,3,2,hh); r(7,4,1,1,shine)
        r(6,6,2,2,hair); r(6,8,1,7,hh)
        r(9,4,2,2,hair); r(10,5,1,1,hair)
        r(14,3,2,1,hh); r(16,5,2,10,hair); r(17,7,1,6,hh)
    elif style=='curls':
        for xx,yy in [(7,1),(10,0),(14,1),(5,3),(8,3),(12,2),(16,4)]:
            r(xx,yy,3,3,hd); r(xx+1,yy+1,2,2,hair)
            r(xx+1,yy+1,1,1,hh)
        r(6,5,11,1,hair); r(6,6,2,2,hair); r(17,6,1,2,hair)
        r(9,5,2,1,hh); r(14,4,1,1,shine)
    else:
        r(7,2,9,1,hd); r(6,3,12,2,hd)
        r(6,5,13,2,hd); r(7,3,9,1,hair)
        r(6,4,11,2,hair); r(7,4,3,1,hh)
        r(10,3,3,1,shine); r(13,4,3,1,hh)
        r(6,6,2,2,hair); r(17,6,1,2,hair)
    if p.get('glasses'):
        for ex in (7,12):
            r(ex,8,5,1,'#50536b'); r(ex,11,5,1,'#50536b')
            r(ex,9,1,2,'#50536b'); r(ex+4,9,1,2,'#50536b')
        r(11,9,2,1,'#50536b')
    a.palette=old_palette


def draw_studies(art_class):
    a=art_class(196,48,'Revised compact pixel characters with centred eyes, shaped shoulders and shorter legs')
    a.palette={}
    a.rect(0,0,196,48,'#29283f')
    for i,p in enumerate(PALETTES):
        x=4+i*32
        a.rect(x+4,41,18,2,'#1b1c31')
        draw_character(a,x,6,index=i)
        a.rect(x+9,46,8,1,p['cloth'][2])
        sprite=art_class(24,36,p['name'].replace('-',' ')+' compact pixel character')
        draw_character(sprite,0,0,index=i)
        sprite.save('character-v3-'+p['name'],scale=6)
    a.save('neon-character-studies-v3',scale=3)
