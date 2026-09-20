"""Original 24x40 human sprites, drawn on an integer pixel grid.

All outlines, hair clusters, eyes and clothing details are authored pixels.
The supplied references inform proportions and detail, not traced silhouettes.
"""

PALETTES = [
    dict(name='mint-jacket', skin=['#f6d0a2','#e3aa79','#b87753'], hair=['#342532','#65382e','#a65b38','#dc9655'], cloth=['#164c50','#228779','#65e7b2'], trousers=['#2b314b','#485776','#6a7b9a'], style='swept', outfit='jacket'),
    dict(name='pink-cardigan', skin=['#f6cfb2','#e3a282','#ad6c5c'], hair=['#382238','#68324e','#ac5265','#ed8890'], cloth=['#682e65','#b74993','#ff91cf'], trousers=['#2c2846','#484066','#70638f'], style='long', outfit='cardigan'),
    dict(name='gold-hoodie', skin=['#d7a27c','#b97e58','#804d3d'], hair=['#231f30','#41303c','#69404b','#976051'], cloth=['#805227','#ca922e','#ffe478'], trousers=['#23394a','#385875','#5883a2'], style='curls', outfit='hoodie'),
    dict(name='violet-vest', skin=['#f1d4b2','#d5ad87','#a77866'], hair=['#434257','#737388','#abaabb','#dfd9e4'], cloth=['#442e77','#7853bb','#c39aff'], trousers=['#302f45','#4d4d65','#71768f'], style='silver', outfit='vest', glasses=True),
    dict(name='cyan-overshirt', skin=['#eac19a','#cb9269','#965b44'], hair=['#222339','#3c3b5a','#686887','#9894aa'], cloth=['#204e74','#2e94c7','#78e2ed'], trousers=['#2d324d','#4c5778','#707ca0'], style='crop', outfit='jacket', glasses=True),
    dict(name='coral-bomber', skin=['#f6caa1','#dea078','#a56b50'], hair=['#432737','#743e36','#b6653e','#efa458'], cloth=['#782e4e','#c64b71','#ff95aa'], trousers=['#2f2e4f','#504575','#8175a3'], style='ponytail', outfit='bomber'),
]


def draw_character(a, x, y, scale=1, index=0):
    p = PALETTES[index]
    skin_hi, skin, skin_lo = p['skin']
    hair_dark, hair, hair_hi, hair_glint = p['hair']
    cloth_dark, cloth, cloth_hi = p['cloth']
    trou_dark, trou, trou_hi = p['trousers']
    ink = '#151a2d'
    old_palette = a.palette
    a.palette = {}

    def r(xx, yy, w, h, color):
        a.rect(x+xx*scale, y+yy*scale, w*scale, h*scale, color)

    # Back hair, drawn first so clothes overlap naturally.
    if p['style'] == 'long':
        r(5, 5, 14, 16, hair_dark); r(4, 9, 16, 16, hair_dark)
        r(5, 10, 3, 14, hair); r(17, 8, 2, 17, hair)
        r(5, 12, 1, 10, hair_hi); r(18, 13, 1, 9, hair_hi)
    elif p['style'] == 'ponytail':
        r(18, 4, 4, 3, hair_dark); r(20, 6, 3, 8, hair_dark)
        r(21, 13, 2, 6, hair_dark); r(19, 17, 3, 3, hair_dark)
        r(20, 6, 2, 7, hair); r(21, 14, 1, 3, hair_hi)
        r(18, 6, 2, 2, cloth_hi)

    # Trousers: distinct legs, small highlights and knee shadows.
    r(7, 27, 11, 4, ink)
    r(7, 30, 5, 8, ink); r(14, 30, 4, 8, ink)
    r(8, 28, 9, 2, trou); r(8, 30, 3, 7, trou)
    r(14, 30, 3, 7, trou); r(8, 31, 1, 4, trou_hi)
    r(15, 31, 1, 3, trou_hi); r(8, 35, 3, 1, trou_dark)
    r(14, 35, 3, 1, trou_dark); r(12, 29, 1, 3, trou_dark)
    # Sneakers with a contrasting toe and a one-pixel sole.
    r(6, 37, 6, 3, ink); r(14, 37, 5, 3, ink)
    r(7, 37, 4, 1, trou_hi); r(15, 37, 3, 1, trou_hi)
    r(7, 38, 4, 1, '#dfdce5'); r(15, 38, 3, 1, '#dfdce5')

    # Relaxed arms: tapered sleeves, cuffs, separate hands.
    r(5, 17, 3, 3, ink); r(4, 20, 4, 8, ink)
    r(17, 17, 3, 4, ink); r(18, 21, 3, 8, ink)
    r(5, 20, 2, 5, cloth); r(5, 20, 1, 3, cloth_hi)
    r(18, 20, 2, 6, cloth); r(19, 23, 1, 2, cloth_dark)
    r(5, 25, 2, 1, cloth_dark); r(18, 26, 2, 1, cloth_dark)
    r(5, 26, 2, 2, skin); r(18, 27, 2, 2, skin)
    r(5, 26, 1, 1, skin_hi); r(19, 28, 1, 1, skin_lo)

    # Fitted torso with a collar and lit edge, not a single flat rectangle.
    r(8, 16, 9, 1, ink); r(7, 17, 11, 12, ink)
    r(8, 17, 9, 11, cloth); r(8, 18, 1, 8, cloth_hi)
    r(16, 19, 1, 8, cloth_dark); r(9, 27, 7, 1, cloth_dark)
    r(10, 15, 5, 3, skin_lo); r(11, 15, 3, 2, skin)

    outfit = p['outfit']
    if outfit in ('jacket', 'cardigan'):
        r(11, 18, 3, 10, '#dfdbc8')
        r(11, 18, 1, 10, '#9b9db1'); r(12, 22, 2, 1, '#a6a9b9')
        r(9, 17, 2, 2, cloth_hi); r(10, 19, 1, 2, cloth_hi)
        r(14, 17, 2, 2, cloth_hi); r(14, 19, 1, 2, cloth_dark)
        r(9, 23, 2, 1, cloth_dark); r(14, 23, 2, 1, cloth_dark)
        r(14, 21, 1, 1, '#f8e4ab'); r(14, 26, 1, 1, '#f8e4ab')
    elif outfit == 'hoodie':
        r(9, 17, 2, 2, cloth_dark); r(14, 17, 2, 2, cloth_dark)
        r(10, 18, 1, 4, cloth_hi); r(14, 18, 1, 4, cloth_hi)
        r(10, 24, 5, 2, cloth_dark); r(11, 24, 3, 1, cloth)
        r(10, 26, 5, 1, cloth_hi)
    elif outfit == 'vest':
        r(5, 20, 2, 5, '#a8b8bc'); r(18, 20, 2, 6, '#d5d9d1')
        r(10, 17, 5, 2, '#e7e7d5'); r(11, 19, 3, 1, '#d0d7ce')
        r(12, 20, 1, 8, cloth_dark)
        for yy in (22,25): r(12, yy, 1, 1, cloth_hi)
        r(9, 23, 2, 2, cloth_dark); r(14, 23, 2, 2, cloth_dark)
    else:
        r(9, 17, 2, 2, cloth_dark); r(14, 17, 2, 2, cloth_dark)
        r(12, 18, 1, 10, '#f4dcbc'); r(13, 18, 1, 10, cloth_dark)
        r(14, 21, 2, 1, cloth_hi); r(9, 24, 2, 2, cloth_dark)

    # Head silhouette, cheek planes and ears. Head is about a third of height.
    r(7, 3, 10, 1, hair_dark); r(5, 4, 14, 6, hair_dark)
    r(6, 9, 13, 4, hair_dark); r(8, 13, 9, 3, hair_dark)
    r(7, 6, 10, 8, skin); r(9, 14, 7, 1, skin_lo)
    r(7, 7, 2, 5, skin_hi); r(9, 6, 6, 2, skin_hi)
    r(16, 8, 1, 6, skin_lo); r(15, 13, 1, 1, skin_lo)
    r(6, 10, 1, 2, skin); r(18, 10, 1, 2, skin_lo)
    # Fine eyes: three pixels wide, with an iris, pupil, and highlight.
    r(9, 9, 3, 3, '#f8edd7'); r(14, 9, 3, 3, '#f8edd7')
    r(10, 9, 2, 3, '#347b70'); r(15, 9, 2, 3, '#347b70')
    r(11, 9, 1, 3, ink); r(16, 9, 1, 3, ink)
    r(10, 9, 1, 1, '#ccf4ce'); r(15, 9, 1, 1, '#ccf4ce')
    r(9, 8, 3, 1, hair); r(14, 8, 3, 1, hair)
    r(13, 11, 1, 2, skin_lo); r(11, 14, 3, 1, skin_hi)

    # Three-tone clustered hair. Variants have distinct silhouettes.
    style = p['style']
    if style in ('swept', 'silver', 'ponytail'):
        r(8, 1, 8, 1, hair_dark); r(6, 2, 12, 2, hair_dark)
        r(4, 4, 15, 2, hair_dark); r(3, 5, 4, 2, hair_dark)
        r(6, 3, 11, 3, hair); r(5, 5, 4, 3, hair)
        r(6, 7, 2, 3, hair); r(17, 5, 1, 4, hair)
        r(8, 2, 7, 1, hair_hi); r(6, 3, 5, 1, hair_hi)
        r(5, 5, 4, 1, hair_hi); r(9, 4, 5, 1, hair_hi)
        r(12, 3, 4, 1, hair_glint); r(6, 5, 1, 1, hair_glint)
        r(8, 6, 3, 1, hair); r(8, 7, 1, 1, hair)
        r(15, 5, 3, 2, hair); r(16, 6, 1, 2, hair_hi)
    elif style == 'long':
        r(8, 1, 8, 1, hair_dark); r(6, 2, 12, 3, hair_dark)
        r(5, 4, 14, 3, hair_dark); r(6, 3, 11, 3, hair)
        r(8, 2, 7, 1, hair_hi); r(6, 4, 4, 2, hair_hi)
        r(7, 4, 1, 1, hair_glint); r(6, 6, 3, 3, hair)
        r(6, 8, 1, 7, hair_hi); r(17, 5, 2, 10, hair)
        r(18, 7, 1, 6, hair_hi); r(9, 5, 3, 1, hair)
        r(16, 4, 1, 2, hair_hi)
    elif style == 'curls':
        for xx, yy in [(7,1),(11,0),(15,2),(4,4),(8,3),(12,3),(16,5),(5,7)]:
            r(xx, yy, 4, 3, hair_dark); r(xx+1, yy+1, 2, 2, hair)
            r(xx+1, yy, 2, 1, hair_hi)
        r(7, 5, 9, 2, hair); r(8, 5, 2, 1, hair_glint)
        r(13, 6, 2, 1, hair_hi); r(17, 8, 1, 2, hair)
    else:
        r(7, 2, 11, 1, hair_dark); r(5, 3, 14, 4, hair_dark)
        r(6, 4, 12, 3, hair); r(7, 3, 10, 1, hair_hi)
        r(7, 4, 4, 1, hair_glint); r(14, 5, 3, 1, hair_hi)
        r(6, 7, 2, 2, hair); r(17, 6, 1, 3, hair)

    if p.get('glasses'):
        for xx in (8,14):
            r(xx, 8, 5, 1, '#34364c'); r(xx, 12, 5, 1, '#34364c')
            r(xx, 9, 1, 3, '#34364c'); r(xx+4, 9, 1, 3, '#34364c')
            r(xx+1, 8, 2, 1, '#93b2c5')
        r(13, 9, 1, 1, '#34364c')
    a.palette = old_palette


def draw_studies(art_class):
    # Six full-height sprites; quiet dividers keep silhouettes easy to compare.
    a = art_class(204,54,'Six original detailed human pixel sprites in neon-accented everyday outfits')
    a.palette = {}
    a.rect(0,0,204,54,'#20243d')
    for i, p in enumerate(PALETTES):
        x = 5+i*34
        a.rect(x+4,47,20,2,'#151b30')
        draw_character(a,x,7,index=i)
        a.rect(x+9,51,10,1,p['cloth'][2])
        sprite = art_class(24,40,p['name'].replace('-',' ')+' pixel character')
        draw_character(sprite,0,0,index=i)
        sprite.save('character-v2-'+p['name'],scale=6)
    a.save('neon-character-studies-v2',scale=6)
