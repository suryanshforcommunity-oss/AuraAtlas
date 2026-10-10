from collections import deque

def shortest_path(start, goal, obstacles, width=12, height=12):
    """Return a list of [x, y] cells from start to goal, or [] if unreachable."""
    start, goal = tuple(start), tuple(goal)
    blocked = {tuple(p) for p in obstacles}
    if start in blocked or goal in blocked:
        return []
    q = deque([start])
    previous = {start: None}
    while q:
        cur = q.popleft()
        if cur == goal:
            break
        x, y = cur
        for nxt in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if not (0 <= nxt[0] < width and 0 <= nxt[1] < height):
                continue
            if nxt in blocked or nxt in previous:
                continue
            previous[nxt] = cur
            q.append(nxt)
    if goal not in previous:
        return []
    path, cur = [], goal
    while cur is not None:
        path.append([cur[0], cur[1]])
        cur = previous[cur]
    return list(reversed(path))
