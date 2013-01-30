(function(global){

  var _r = {},	
		_m = {},	
		_c = {};
	
	var _fn = {};
	//用于类扩展的工具函数
	_fn.extend = function(Classes, members, methods){
		
		var newClass = function(){
			var me = this;
			if(Classes instanceof Array){
				Classes.forEach(function(c){
					cloneMember(c, me);
				});
			} else {
				cloneMember(Classes, me);
			}

            for (var key in members){
                me[key] = members[key];
            }
		};

		if(Classes instanceof Array){
			Classes.forEach(function(c){
				cloneMethod(c, newClass)
			})
		} else {
			cloneMethod(Classes, newClass)
		}

        for(var key in methods){
            newClass.prototype[key] = methods[key];
        }

        return newClass;

		function cloneMember(cls, tar){
			if (cls instanceof Function){
				cls.call(tar);
			} 
		}
		function cloneMethod(cls, tar){
			if(cls instanceof Function){
				for(var key in cls.prototype){
					tar.prototype[key] = cls.prototype[key];
				}
			}
		}
	};

	//复制一个类
	_fn.clone = function(cls){
		return _fn.extend(cls);
	};

	//Model-Controller-Renderer组元的基类
	var _Class = function (){};

	//config是根据具体产品需要，用于扩展各组元的函数
	_Class.prototype.config = function(members, methods){
		for(var key in members){
			this[key] = members[key];
		}
		for (var key in methods){
			this.constructor.prototype[key] = methods[key];
		}
		return this;
	};

	//_Model 是_Class的子类，继承了其config方法
	var _Model  = _fn.extend(_Class,{},{
		//从服务器获取数据的成员函数
		fetch: function(_url){
		    return WinJS.xhr({
                url: _url,
                type: "GET",
                responseType: "json"
            }).then(function (res) {
                return window.JSON.parse(res.responseText);
            })
		}
	});
	//_Render 是_Class的子类，继承了其config方法
	var _Render = _fn.extend(_Class,{
	},{
		//以$开头的成员函数类似于jQuery返回自身，从而可以实现链式结构
		//被操作的变量被记录在内部对象 _r 中，不对外开放
		// 本函数将string转化为相应的DOM元素，并将该元素记录在 _r.elm 中
		$: (function(){
			var factory = document.createElement("div");
			return function(html){
				var html = html || "";
				factory.innerHTML = window.toStaticHTML(html);
				if(factory.childNodes.length>1){
					console.log("warning: only the first node built")
				}
				 _r.elm = factory.firstChild;
				 return this;	
			}
		})(),
		//将 内部对象 _r.elm 添加到tar元素中
		$appendTo: function(tar){
			tar.appendChild(_r.elm);
			return this;
		},
		//用于将数据灌入tpl字符串中的相映占位符
		format: function(tpl, data, attr){
			return tpl.replace(/#\{(.+?)\}/g, function(_,key){
				return data[key]
			}).replace(/@\{(.+?)\}/g, function(_,key){
				return attr[key]
			})
		},
		//lazyloading 图片
		lazyLoadImg: function(imgHolders, onload){
			imgHolders.forEach(function(elm){
				var img = new Image(), src = elm.getAttribute('data-src');
				img.onload = function(){
					if(!! elm.parentNode){
						elm.parentNode.replaceChild(img, elm)
					} else {
						elm.src = src;
					}
					onload && onload();
				}
				img.src = src;
			})
		},

		//绑定事件
		bindEvents: function(elms, evtMap, capture){
			if(!(typeof evtMap =="object")) return;

			var capture = capture || false;


			if(elms.length){
				for(var i = 0, l=elms.length; i<l; i++){
					_bindEvents(elms[i], evtMap)
				}
			} else {
				_bindEvents(elms, evtMap);
			}

			function _bindEvents(elm, evtMap){
				if(elm && !!elm.addEventListener){
					for(var key in evtMap){
						var handler = evtMap[key].bind(elm); 
						// "this" in handler denotes the elm with event been added
						elm.addEventListener(key, handler, capture);
					}
				}
			}
		} 
	});

	//_Ctrl 是_Class的子类，继承了其config方法
	var _Ctrl   = _fn.extend(_Class,{},{
		//流程化操作的管道函数
		pipe: function(){
			var me = this;
			var funs = Array.prototype.map.call(arguments,function(item){
				return item.bind(me);
			});
			var len = funs.length;

			var start = funs.shift();
			if(start instanceof WinJS.Promise){
				var pro = start;
			} else if(start instanceof Function){
				var pro = WinJS.Promise.timeout().then(start);
			} else {
				throw Error("error input type")
			}

			var fun = null;
			while(fun=funs.shift()){
				if(fun instanceof Function){
					pro=pro.then(fun);
				} else {
					throw Error("error input type")
				}
			}
			pro.done();
		}		
	});

	//Astro 封装了 Model，Render，Ctrl三个类成员
	//并建立了三者的相互成员关系，便于彼此调用
	//一个具体应用app将作为Astro的实例化被声明出来
	
	var _Astro = function(){
		var ThisModel = _fn.clone(_Model);
		var ThisRender = _fn.clone(_Render);
		var ThisCtrl = _fn.clone(_Ctrl);


		this.ctrl   = new ThisCtrl();
		this.model  = new ThisModel();
		this.render = new ThisRender();


		this.ctrl.model = this.model;
		this.model.ctrl = this.ctrl;

		this.ctrl.render = this.render;
		this.render.ctrl = this.ctrl;

		this.model.render = this.render;
		this.render.model = this.model;		
	};

	//具体应用的创建函数
	_fn.create = function(str){
		var ns = str.split("."), l=ns.length;
		//validate ns.....
		if(l==1){
			var a = ns[0];
			if(global[a]){
				console.log("warning: ns is not valid 1");
			} 
			global[a] = new _Astro();
		}
		if(l>1) {
			var a = ns[0];
			var b = ns[1];
			if(l>2){
				console.log("warning: ns is not valid 2");
			}
			global[a] = global[a] || {};

			if(global[a][b]){
				console.log("warning: ns is not valid 3");
			} 
			global[a][b] = new _Astro();
		}
	};


	_Astro.fn = _fn;
	global.Astro = _Astro;
})(window);

