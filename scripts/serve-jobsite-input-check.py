"""Serve the unchanged game with a local-only browser input regression page."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'web'), **kwargs)

    def translate_path(self, path):
        if path.split('?', 1)[0] == '/__input-check':
            return str(ROOT / 'scripts' / 'jobsite-input-check.html')
        if path.split('?', 1)[0] == '/__project-check':
            return str(ROOT / 'scripts' / 'jobsite-project-check.html')
        return super().translate_path(path)

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path != '/__input-fixture':
            return super().do_GET()
        page = ROOT / 'web' / 'jobsite.html'
        if not page.exists():
            page = ROOT / 'web' / 'index.html'
        html = page.read_text()
        bootstrap = "const values=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}});"
        html = html.replace('<head>', '<head><script>' + bootstrap + '</script>')
        html = html.replace('<script src="/assets/js/posthog.js"></script>', '')
        query = parse_qs(url.query)
        if query.get('saved') == ['true']:
            seed = 'const s=JobsiteSim.createState(0,true);JobsiteSim.start(s);JobsiteSim.setOperateHeld(s,true);JobsiteSim.step(s,1.5);JobsiteSim.setOperateHeld(s,false);JobsiteSim.step(s,4);JobsiteSim.backUp(s);JobsiteSim.step(s,2);JobsiteSave.write(localStorage,s);'
            scenarios = {
                'crew': 's.crew[0]={x:s.machine.x,z:s.machine.z};s.safetyStop=true;',
                'truck': 's.machine.x=-5.4;s.truckPose=JobsiteSim.truckPosition(s);s.truckParked=true;s.haulBlocked=true;s.crew=s.crew.map((_,i)=>JobsiteSim.crewHome(s,i));',
                'overlap': 's.truckPose=JobsiteSim.crewHome(s,0);s.truckParked=true;',
                'project-fill': "JobsiteSim.startProject(s);JobsiteSim.setPrimaryHeld(s,true);for(let i=0;i<10000;i++){JobsiteSim.step(s,.1);if(s.project.work?.type==='fill'&&s.project.work.applied>.2)break;}JobsiteSim.setPrimaryHeld(s,false,true);",
                'grade': 's.machine.x=0;JobsiteSim.setOperateHeld(s,true);JobsiteSim.step(s,20);JobsiteSim.setOperateHeld(s,false);',
                'ended': "s.status='lost';",
            }
            setup = scenarios.get(query.get('scenario', [''])[0], '')
            seed = seed.replace('JobsiteSave.write(localStorage,s);', setup + 'JobsiteSave.write(localStorage,s);')
            html = html.replace('<script src="/assets/js/jobsite.js">', '<script>' + seed + '</script><script src="/assets/js/jobsite.js">')
        if query.get('speed') == ['12']:
            speed = 'const realStep=JobsiteSim.step;JobsiteSim.step=(state,dt)=>realStep(state,dt*12);'
            html = html.replace('<script src="/assets/js/jobsite.js">', '<script>' + speed + '</script><script src="/assets/js/jobsite.js">')
        body = html.encode()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=4181)
    args = parser.parse_args()
    print(f'Open http://127.0.0.1:{args.port}/__input-check', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
