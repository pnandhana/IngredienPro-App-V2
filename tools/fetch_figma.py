#!/usr/bin/env python3
"""Pull every frame in FINAL SCREENS from the Figma REST API and compile it
into one small JS file per screen (app-v2/screens/<id>.js) plus a manifest.

Token: read from ~/.figma_token (never printed). Re-run any time the Figma file
changes:  python3 tools/fetch_figma.py
"""
import json, os, sys, time, urllib.request, urllib.parse, pathlib

FILE_KEY = "lDikeJ9FNKkACdCVs1omaW"
PAGE_ID = "143:973"
SECTION_ID = "635:22096"          # FINAL SCREENS
ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT.parent / ".figma-cache-app-v2"; RAW.mkdir(parents=True, exist_ok=True)   # kept outside the deploy folder
OUT = ROOT / "screens"; OUT.mkdir(exist_ok=True)
TOKEN = pathlib.Path("~/.figma_token").expanduser().read_text().strip()

def api(path, params=None):
    url = "https://api.figma.com/v1/" + path
    if params: url += "?" + urllib.parse.urlencode(params, safe=":,")
    for attempt in range(6):
        req = urllib.request.Request(url, headers={"X-Figma-Token": TOKEN})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = int(e.headers.get("Retry-After", "20")); print(f"  rate-limited, waiting {wait}s"); time.sleep(wait); continue
            print("HTTP", e.code, e.read()[:300]); raise
        except Exception as e:
            print("  retry after error:", e); time.sleep(5)
    raise SystemExit("gave up")

def nodes(ids, depth=None):
    out = {}
    for i in range(0, len(ids), 4):
        batch = ids[i:i+4]
        cache = RAW / ("nodes_" + "_".join(x.replace(":", "-") for x in batch) + ".json")
        if cache.exists() and "--fresh" not in sys.argv:
            data = json.loads(cache.read_text())
        else:
            params = {"ids": ",".join(batch)}
            if depth: params["depth"] = depth
            data = api(f"files/{FILE_KEY}/nodes", params); cache.write_text(json.dumps(data))
        for k, v in data["nodes"].items():
            out[k] = v["document"] if v else None
        print(f"  fetched {min(i+4,len(ids))}/{len(ids)}")
    return out

# ---- compact the Figma document into what the renderer needs -------------
KEEP_LAYOUT = ["layoutMode","primaryAxisSizingMode","counterAxisSizingMode","primaryAxisAlignItems",
 "counterAxisAlignItems","paddingLeft","paddingRight","paddingTop","paddingBottom","itemSpacing",
 "counterAxisSpacing","layoutWrap","layoutSizingHorizontal","layoutSizingVertical","layoutGrow",
 "layoutAlign","layoutPositioning","clipsContent","minWidth","maxWidth","minHeight","maxHeight",
 "strokeAlign","strokeWeight","cornerRadius","rectangleCornerRadii","opacity","isFixed","scrollBehavior",
 "individualStrokeWeights","strokeDashes","textAlignHorizontal"]

def col(c, a=1):
    r,g,b = round(c["r"]*255), round(c["g"]*255), round(c["b"]*255)
    a = round(c.get("a",1)*a, 3)
    return f"#{r:02x}{g:02x}{b:02x}" if a >= 1 else f"rgba({r},{g},{b},{a})"

def paints(ps):
    out = []
    for p in ps or []:
        if p.get("visible") is False or p.get("type") != "SOLID": continue
        out.append(col(p["color"], p.get("opacity", 1)))
    return out

def compact(n, parent_box=None, dests=None):
    if n.get("visible") is False: return None
    t = n["type"]
    box = n.get("absoluteBoundingBox") or {"x":0,"y":0,"width":0,"height":0}
    o = {"i": n["id"], "t": t, "n": n.get("name",""),
         "w": round(box["width"],1), "h": round(box["height"],1)}
    if parent_box:
        o["x"] = round(box["x"]-parent_box["x"],1); o["y"] = round(box["y"]-parent_box["y"],1)
    for k in KEEP_LAYOUT:
        if k in n and n[k] not in (None, 0, False, "", "INHERIT") or (k=="opacity" and n.get(k) not in (None,1)):
            if k=="opacity" and n.get(k) in (None,1): continue
            o[k] = n[k]
    f = paints(n.get("fills")); s = paints(n.get("strokes"))
    if f: o["fill"] = f
    if s and n.get("strokeWeight",0) > 0: o["stroke"] = s
    fx = []
    for e in n.get("effects") or []:
        if e.get("visible") is False: continue
        if e["type"] == "DROP_SHADOW":
            fx.append({"k":"shadow","c":col(e["color"]),"x":e["offset"]["x"],"y":e["offset"]["y"],"r":e["radius"],"s":e.get("spread",0)})
        elif e["type"] == "LAYER_BLUR":
            fx.append({"k":"blur","r":e["radius"]})
    if fx: o["fx"] = fx
    inter = []
    for it in n.get("interactions") or []:
        trig = (it.get("trigger") or {}).get("type")
        for a in it.get("actions") or []:
            if not a or a.get("type") != "NODE": continue
            to = a.get("destinationId")
            if not to and a.get("navigation") == "NAVIGATE": to = n.get("transitionNodeID")
            if not to: continue
            inter.append({"on":trig,"to":to,"nav":a.get("navigation")})
            if dests is not None: dests.add((a.get("navigation"), to))
    if not inter and n.get("transitionNodeID"):
        inter.append({"on":"ON_CLICK","to":n["transitionNodeID"],"nav":"NAVIGATE"})
    if inter: o["go"] = inter
    if t == "TEXT":
        st = n.get("style", {})
        o["tx"] = n.get("characters","")
        o["st"] = {k: st.get(k) for k in ("fontFamily","fontWeight","fontSize","textAlignHorizontal","letterSpacing","lineHeightPx","italic","textAutoResize","textCase","textDecoration","textTruncation","maxLines") if st.get(k) not in (None,)}
        ov = n.get("characterStyleOverrides") or []
        if ov and any(ov):
            tbl = n.get("styleOverrideTable") or {}
            o["ov"] = ov; o["ot"] = {k: {kk: vv for kk, vv in v.items() if kk in ("fontWeight","fontSize","fills","textDecoration","italic")} for k, v in tbl.items()}
            for k, v in o["ot"].items():
                if "fills" in v: v["fills"] = paints(v["fills"])
    kids = []
    for c in n.get("children") or []:
        cc = compact(c, box, dests)
        if cc: kids.append(cc)
    if kids: o["c"] = kids
    return o

FLOWS = [{"id":i,"name":n} for i,n in [
 ("597:18217","01 Guest · Browse categories → product → sellers"),
 ("635:19637","02 Guest · Find a seller → Send enquiry → sign-up gate"),
 ("544:3","03 Register Free · Buyer — account → preferences"),
 ("544:95","04 Register Free · Seller — account → documents → products & plan → go live"),
 ("526:2","05 Log in · WhatsApp or email (buyer & seller)"),
 ("567:2632","06 Buyer · Send an enquiry — one or more products, from results or a seller profile (incl. product the seller doesn’t sell)"),
 ("756:1673","07 Buyer · Post a requirement → sent to all sellers in the category"),
 ("635:22487","08 Buyer · My enQ → chats & My Account"),
 ("283:5025","09 Seller · Seller Hub → dashboard & sections"),
 ("283:4837","10 Seller · My enQ → accept or decline a chat request"),
 ("752:2981","11 Seller · Requirement request (posted to the whole category) → accept or decline")]]

def main():
    print("1/4 reading the FINAL SCREENS section…")
    sec = nodes([SECTION_ID], depth=2)[SECTION_ID]
    frames = []
    for sub in sec.get("children", []):
        if sub["type"] != "SECTION": continue
        for f in sub.get("children", []):
            if f["type"] == "FRAME" and not f["name"].startswith(("Row heading","Notes","Recovery link")):
                frames.append((sub["name"], f["id"], f["name"]))
    print(f"   {len(frames)} frames")
    print("2/4 fetching frames…")
    docs = nodes([f[1] for f in frames])
    dests = set(); manifest = {"screens": {}, "flows": [], "variants": {}}
    for sec_name, fid, name in frames:
        d = docs.get(fid)
        if not d: print("   missing", fid); continue
        c = compact(d, None, dests)
        (OUT / (fid.replace(":", "-") + ".js")).write_text("SCREEN(" + json.dumps(c, ensure_ascii=False, separators=(",",":")) + ");\n")
        manifest["screens"][fid] = {"name": name, "section": sec_name, "w": c["w"], "h": c["h"]}
    print("3/4 fetching interactive-component variants…")
    var_ids = sorted({d for nav, d in dests if nav == "CHANGE_TO"})
    if var_ids:
        vd = nodes(var_ids)
        for vid, d in vd.items():
            if d: manifest["variants"][vid] = compact(d)
    print("4/4 reading prototype flows…")
    page = api(f"files/{FILE_KEY}/nodes", {"ids": PAGE_ID, "depth": 1})["nodes"][PAGE_ID]["document"]
    manifest["flows"] = [{"id": f["nodeId"], "name": f["name"]} for f in page.get("flowStartingPoints", [])] or FLOWS
    (ROOT / "js" / "manifest.js").write_text("const MANIFEST = " + json.dumps(manifest, ensure_ascii=False) + ";\n")
    size = sum(p.stat().st_size for p in OUT.glob("*.js"))
    print(f"done: {len(manifest['screens'])} screens, {len(manifest['flows'])} flows, {len(manifest['variants'])} variants, {size/1e6:.1f} MB")

if __name__ == "__main__":
    main()
