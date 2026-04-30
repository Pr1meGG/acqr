import ast
import re
from typing import List, Dict

def detect_intent_mismatch(code: str) -> List[Dict]:
    issues = []
    
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return issues
        
    lines = code.splitlines()

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            func_name = node.name.lower()
            params = [arg.arg for arg in node.args.args]
            
            # Extract variables used in the function body
            used_vars = set()
            constants_used = set()
            for sub_node in ast.walk(node):
                if isinstance(sub_node, ast.Name) and isinstance(sub_node.ctx, ast.Load):
                    used_vars.add(sub_node.id)
                if isinstance(sub_node, ast.Constant):
                    constants_used.add(sub_node.value)
            
            # RULE 1: Unused parameter
            for param in params:
                if param not in used_vars and param != "_":
                    issues.append({
                        "line": node.lineno,
                        "type": "logical",
                        "message": f"Unused parameter '{param}'",
                        "explanation": f"The parameter '{param}' is defined in function '{node.name}' but never used.",
                        "suggestion": f"Use the parameter '{param}' in your logic, or remove it from the signature.",
                        "confidence": 0.9,
                        "source": ["heuristic", "intent"],
                        "root_cause": "Parameter declared but not referenced",
                        "severity": "medium",
                        "fix": None
                    })
                    
            # Check return expressions for RULE 2 and RULE 3
            for sub_node in ast.walk(node):
                if isinstance(sub_node, ast.Return) and sub_node.value:
                    val_node = sub_node.value
                    
                    # RULE 2: Function name vs operation mismatch
                    if isinstance(val_node, ast.BinOp):
                        op = type(val_node.op)
                        # Name 'square', 'multiply', 'product'
                        if any(kw in func_name for kw in ["square", "multiply", "product", "times"]):
                            if op in (ast.Add, ast.Sub, ast.Div):
                                line_content = lines[sub_node.lineno - 1]
                                replacement = line_content.replace("+", "*").replace("-", "*").replace("/", "*")
                                issues.append({
                                    "line": sub_node.lineno,
                                    "type": "logical",
                                    "message": f"Operation mismatch in '{node.name}'",
                                    "explanation": "Function name implies multiplication or squaring, but uses a different operator.",
                                    "suggestion": "Change the operator to '*'.",
                                    "confidence": 0.8,
                                    "source": ["heuristic", "intent"],
                                    "root_cause": "Operator contradicts function name",
                                    "severity": "high",
                                    "fix": {
                                        "type": "patch",
                                        "changes": [{"line_start": sub_node.lineno, "line_end": sub_node.lineno, "replacement": replacement}]
                                    }
                                })
                        # Name 'add', 'sum'
                        elif "add" in func_name or "sum" in func_name:
                            if op in (ast.Mult, ast.Sub, ast.Div):
                                issues.append({
                                    "line": sub_node.lineno,
                                    "type": "logical",
                                    "message": f"Operation mismatch in '{node.name}'",
                                    "explanation": "Function name implies addition, but uses a different operator.",
                                    "suggestion": "Check if you intended to add.",
                                    "confidence": 0.8,
                                    "source": ["heuristic", "intent"],
                                    "root_cause": "Operator contradicts function name",
                                    "severity": "medium",
                                    "fix": None
                                })
                        # Name 'divide', 'div'
                        elif "div" in func_name:
                            if op in (ast.Add, ast.Sub, ast.Mult):
                                issues.append({
                                    "line": sub_node.lineno,
                                    "type": "logical",
                                    "message": f"Operation mismatch in '{node.name}'",
                                    "explanation": "Function name implies division, but uses a different operator.",
                                    "suggestion": "Check if you intended to divide.",
                                    "confidence": 0.8,
                                    "source": ["heuristic", "intent"],
                                    "root_cause": "Operator contradicts function name",
                                    "severity": "medium",
                                    "fix": None
                                })

                    # RULE 3: Suspicious constant usage instead of parameter
                    if len(params) >= 2 and isinstance(val_node, ast.BinOp):
                        # If right is a Constant, and there's a 2nd parameter unused
                        if isinstance(val_node.right, ast.Constant) and type(val_node.right.value) in (int, float):
                            p2 = params[1]
                            if p2 not in used_vars:
                                issues.append({
                                    "line": sub_node.lineno,
                                    "type": "logical",
                                    "message": "Suspicious constant usage",
                                    "explanation": f"You are using a constant '{val_node.right.value}' instead of the provided parameter '{p2}'.",
                                    "suggestion": f"Replace the constant with '{p2}'.",
                                    "confidence": 0.7,
                                    "source": ["heuristic", "intent"],
                                    "root_cause": "Hardcoded value overrides parameter",
                                    "severity": "medium",
                                    "fix": None
                                })
                                    
    return issues
