# Fix 1: Append CSS overrides to force white on modal hero h1 title
css_override = """
/* Force white title in recipe modal hero (overrides global h1 green color) */
.modal-hero-title h1 {
  color: #fff !important;
}
.modal-hero-title p {
  color: rgba(255,255,255,0.88) !important;
}
"""

with open('style.css', 'ab') as f:
    f.write(css_override.encode('utf-8'))
print('style.css: white title override appended')

# Fix 2: Replace banana emoji in script.js if any remain
with open('script.js', 'r', encoding='utf-8') as f:
    js = f.read()

banana = '\U0001f34c'  # 🍌
if banana in js:
    js = js.replace(banana + ' Authentic', '\u2728 Authentic')
    with open('script.js', 'w', encoding='utf-8') as f:
        f.write(js)
    print('script.js: banana emoji removed')
else:
    print('script.js: banana already removed')
