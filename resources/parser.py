#!/usr/bin/env python3
"""
VisualPy AST Parser
Parses Python source code and outputs a normalized JSON AST.

This script is invoked by the VS Code extension to parse Python files.
It reads source code from stdin and outputs JSON to stdout.
"""

import ast
import json
import sys
import re
from typing import Any, Dict, List, Optional


def extract_comments(source: str) -> List[Dict[str, Any]]:
    """Extract all comments with their line numbers and positions."""
    comments = []
    lines = source.split('\n')
    
    for i, line in enumerate(lines, 1):
        # Find comments (but not inside strings)
        in_string = False
        string_char = None
        col = 0
        
        while col < len(line):
            char = line[col]
            
            # Handle string detection
            if char in '"\'':
                if not in_string:
                    # Check for triple quotes
                    if line[col:col+3] in ('"""', "'''"):
                        in_string = True
                        string_char = line[col:col+3]
                        col += 3
                        continue
                    else:
                        in_string = True
                        string_char = char
                elif string_char and len(string_char) == 3 and line[col:col+3] == string_char:
                    in_string = False
                    string_char = None
                    col += 3
                    continue
                elif string_char and len(string_char) == 1 and char == string_char:
                    in_string = False
                    string_char = None
            
            # Check for comment
            if char == '#' and not in_string:
                comment_text = line[col+1:].strip()
                # Determine if it's inline (code before the #)
                code_before = line[:col].strip()
                comments.append({
                    'line': i,
                    'column': col,
                    'text': comment_text,
                    'inline': bool(code_before)
                })
                break
            
            col += 1
    
    return comments


def get_source_segment(source_lines: List[str], node: ast.AST) -> Optional[str]:
    """Extract the source code for an AST node."""
    if not hasattr(node, 'lineno') or node.lineno is None:
        return None
    
    start_line = node.lineno - 1
    end_line = getattr(node, 'end_lineno', node.lineno) - 1
    start_col = getattr(node, 'col_offset', 0)
    end_col = getattr(node, 'end_col_offset', None)
    
    if start_line >= len(source_lines):
        return None
    
    if start_line == end_line:
        line = source_lines[start_line]
        if end_col is not None:
            return line[start_col:end_col]
        return line[start_col:]
    
    # Multi-line source
    lines = source_lines[start_line:end_line + 1]
    if not lines:
        return None
    
    lines[0] = lines[0][start_col:]
    if end_col is not None and lines:
        lines[-1] = lines[-1][:end_col]
    
    return '\n'.join(lines)


def node_to_dict(node: ast.AST, source_lines: List[str]) -> Dict[str, Any]:
    """Convert an AST node to a dictionary representation."""
    result: Dict[str, Any] = {
        'type': node.__class__.__name__,
        'lineno': getattr(node, 'lineno', None),
        'col_offset': getattr(node, 'col_offset', None),
        'end_lineno': getattr(node, 'end_lineno', None),
        'end_col_offset': getattr(node, 'end_col_offset', None),
    }
    
    # Get source segment for this node
    source = get_source_segment(source_lines, node)
    if source:
        result['source'] = source
    
    # Process all fields of the node
    for field, value in ast.iter_fields(node):
        if isinstance(value, list):
            result[field] = []
            for item in value:
                if isinstance(item, ast.AST):
                    result[field].append(node_to_dict(item, source_lines))
                else:
                    result[field].append(item)
        elif isinstance(value, ast.AST):
            result[field] = node_to_dict(value, source_lines)
        else:
            # Handle special types
            if value is None or isinstance(value, (str, int, float, bool)):
                result[field] = value
            else:
                result[field] = str(value)
    
    return result


def parse_python(source: str) -> Dict[str, Any]:
    """Parse Python source code and return normalized AST as JSON-serializable dict."""
    source_lines = source.split('\n')
    comments = extract_comments(source)
    
    try:
        tree = ast.parse(source)
        return {
            'success': True,
            'ast': node_to_dict(tree, source_lines),
            'comments': comments,
            'errors': []
        }
    except SyntaxError as e:
        return {
            'success': False,
            'ast': None,
            'comments': comments,
            'errors': [{
                'message': str(e.msg) if e.msg else str(e),
                'lineno': e.lineno,
                'col_offset': e.offset
            }]
        }
    except Exception as e:
        return {
            'success': False,
            'ast': None,
            'comments': comments,
            'errors': [{
                'message': str(e),
                'lineno': None,
                'col_offset': None
            }]
        }


def main():
    """Main entry point - read from stdin, write JSON to stdout."""
    try:
        source = sys.stdin.read()
        result = parse_python(source)
        print(json.dumps(result))
    except Exception as e:
        error_result = {
            'success': False,
            'ast': None,
            'comments': [],
            'errors': [{
                'message': f'Parser error: {str(e)}',
                'lineno': None,
                'col_offset': None
            }]
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == '__main__':
    main()
