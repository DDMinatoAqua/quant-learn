"""第 3 章:从 Python 函数自动生成工具 schema,并在执行前校验参数。
这正是 OpenAI Agents SDK 的 @function_tool、smolagents 的 @tool、MCP SDK 的 @mcp.tool() 在背后做的事(简化版)。"""
import inspect, json, typing

PY2JSON = {str: "string", int: "integer", float: "number", bool: "boolean", list: "array", dict: "object"}

def tool(fn):
    """装饰器:读取函数的类型注解和 docstring,生成 JSON Schema。"""
    doc = inspect.getdoc(fn) or ""
    desc, _, arg_part = doc.partition("参数:")
    arg_docs = {}
    for line in arg_part.strip().splitlines():          # 约定格式:"  名字: 说明"
        k, _, v = line.strip().partition(":")
        if v: arg_docs[k.strip()] = v.strip()
    props, required = {}, []
    for name, p in inspect.signature(fn).parameters.items():
        ann = p.annotation
        origin = typing.get_origin(ann)
        if origin is typing.Literal:                    # Literal["a","b"] -> enum,把可选值直接告诉模型
            schema = {"type": "string", "enum": list(typing.get_args(ann))}
        elif origin is list:
            item = typing.get_args(ann)[0] if typing.get_args(ann) else str
            schema = {"type": "array", "items": {"type": PY2JSON.get(item, "string")}}
        else:
            schema = {"type": PY2JSON.get(ann, "string")}
        if name in arg_docs: schema["description"] = arg_docs[name]
        if p.default is inspect.Parameter.empty: required.append(name)
        else: schema["default"] = p.default
        props[name] = schema
    fn.schema = {"name": fn.__name__, "description": desc.strip(),
                 "parameters": {"type": "object", "properties": props, "required": required,
                                "additionalProperties": False}}
    return fn

def validate(schema, args):
    errs = []
    props, req = schema["parameters"]["properties"], schema["parameters"]["required"]
    for r in req:
        if r not in args: errs.append(f"缺少必填参数 `{r}`")
    for k, v in args.items():
        if k not in props: errs.append(f"未知参数 `{k}`(可用参数:{', '.join(props)})"); continue
        t = props[k]["type"]
        ok = {"string": isinstance(v, str), "integer": isinstance(v, int) and not isinstance(v, bool),
              "number": isinstance(v, (int, float)), "boolean": isinstance(v, bool),
              "array": isinstance(v, list), "object": isinstance(v, dict)}[t]
        if not ok: errs.append(f"参数 `{k}` 应为 {t},收到 {type(v).__name__}: {v!r}")
        if "enum" in props[k] and v not in props[k]["enum"]:
            errs.append(f"参数 `{k}` 只能取 {props[k]['enum']},收到 {v!r}")
    return errs

@tool
def search_articles(query: str, limit: int = 5, response_format: typing.Literal["concise", "detailed"] = "concise"):
    """在内容库中按关键词检索文章。需要找素材或定位某篇文章时使用;不要用它读全文(用 get_article)。
    参数:
      query: 检索关键词,建议 2~6 个词
      limit: 返回条数,1~20
      response_format: concise 只返回标题和 id;detailed 额外返回摘要和作者
    """
    return [{"id": "a-101", "title": "折叠屏手机横评"}][:limit]

print("① 自动生成的 schema(OpenAI 的 parameters / Anthropic 的 input_schema 都是这一段):")
print(json.dumps(search_articles.schema, ensure_ascii=False, indent=2))

def to_openai(s):    return {"type": "function", "function": s}
def to_anthropic(s): return {"name": s["name"], "description": s["description"], "input_schema": s["parameters"]}
print("\n② 同一个工具,两家 API 的包装差异:")
print("OpenAI    顶层键:", list(to_openai(search_articles.schema)), "→", list(to_openai(search_articles.schema)["function"]))
print("Anthropic 顶层键:", list(to_anthropic(search_articles.schema)))

print("\n③ 校验模型给的参数:")
for args in [{"query": "折叠屏"}, {"q": "折叠屏", "limit": "3"}, {"query": "折叠屏", "response_format": "full"}]:
    errs = validate(search_articles.schema, args)
    print(" ", json.dumps(args, ensure_ascii=False).ljust(48), "->", "通过 ✅" if not errs else "错误:" + ";".join(errs))
