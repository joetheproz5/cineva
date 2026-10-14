const test=require('node:test'),assert=require('node:assert/strict'),tools=require('../progress-tools');
test('CSV handles BOM, commas, escaped quotes and multiline names',()=>{
 const rows=tools.parse('\uFEFFTitle,Date\r\n"A, \"\"film\"\"",10/1/26\r\n"Another\nfilm",10/2/26');assert.equal(rows.length,2);assert.equal(rows[0].title,'A, "film"');assert.equal(rows[1].title,'Another\nfilm');
});
test('explicit IDs and Netflix named episodes remain reviewable; movie colons are not seasons',()=>{
 const [episode]=tools.parse('Title,Date\nBreaking Bad: Season 1: Pilot,10/1/26');assert.equal(episode.query,'Breaking Bad');assert.equal(episode.season,1);assert.equal(episode.episode,null);assert.equal(episode.episodeTitle,'Pilot');
 const [movie]=tools.parse('Title,Date\nSpider-Man: No Way Home,10/1/26');assert.equal(movie.query,'Spider-Man: No Way Home');assert.equal(movie.type,null);
 const [explicit]=tools.parse('tmdb_id,type,season,episode,title\n1396,tv,4,6,Breaking Bad');assert.equal(explicit.id,1396);assert.equal(explicit.season,4);assert.equal(explicit.episode,6);
});
test('JSON history never imports its reported durations as real watch time',()=>{const [row]=tools.parse('[{"id":1396,"type":"tv","season":1,"episode":1,"currentTime":99999,"duration":99999}]');assert.equal(row.id,1396);assert.equal(row.currentTime,undefined);assert.equal(row.duration,undefined);});
test('malformed, empty and oversized files fail before matching',()=>{
 for(const input of ['Title\n"bad','Nope\nabc','Title,Date\n','['+Array.from({length:501},()=>'{"id":1}').join(',')+']'])assert.throws(()=>tools.parse(input));
 assert.throws(()=>tools.parse('a'.repeat(2000001)),/2 MB/);
});
test('catch-up includes earlier aired regular episodes, not specials, future or undated ones',()=>{
 const seasons=[{season_number:0,episodes:[{episode_number:1,air_date:'2020-01-01'}]},{season_number:1,episodes:[{episode_number:1,air_date:'2020-01-01'},{episode_number:2,air_date:null}]},{season_number:2,episodes:[{episode_number:1,air_date:'2020-02-01'},{episode_number:2,air_date:'2020-02-02'},{episode_number:3,air_date:'2099-01-01'}]}];
 assert.deepEqual(tools.episodesThrough(seasons,2,2,'2026-10-14').map(item=>[item.season,item.episode.episode_number]),[[1,1],[2,1],[2,2]]);assert.throws(()=>tools.episodesThrough(seasons,2,3,'2026-10-14'),/release/);assert.throws(()=>tools.episodesThrough(seasons,2,4,'2026-10-14'),/release/);
});
