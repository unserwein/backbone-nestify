(function (factory){
    // node
    if (typeof module === 'object') {
        module.exports = factory(
            require('underscore'), 
            require('backbone'), 
            require('chai'), 
            require('mocha'),
            require('../backbone-nestify'));
    // require.js
    } else if (typeof define === 'function' && define.amd) {
        define([
            "underscore", 
            "backbone",
            "chai",
            "mocha",
            "backbone-nestify"
        ], factory);
    } else {
        // globals 
        factory(this._, this.Backbone, this.chai, this.mocha, this.nestify);
    }
}(function(_, Backbone, chai, mocha, nestify) {

    var assert = chai.assert;

    describe('Nestify', function(){

        var env;

        beforeEach(function(){

            /*
             specs:

             ShoppingCart
              - "currentOrder" => Order   0..1
              - "account"      => Account 1

             Account
              - "orders"       => [Order] 0..*

             Order
              - "items"        => [Item]  0..*
              - "gift"         => Account 0..1 //contrived...an order can optionally be a gift for another account
             */

            var BarModel = Backbone.Model;
            var BazCollection = Backbone.Collection.extend({model:BarModel});
            var FooModel = Backbone.Model.extend(nestify({
                "bar":{constructor:BarModel},
                "baz":{constructor:BazCollection}
            }));

            // more complex nesting
            var ColModel = Backbone.Model;
            var ColCollection = Backbone.Collection.extend({model:ColModel});
            var StructModel = Backbone.Model.extend(nestify({
                cols:{constructor:ColCollection}
            }));
            var StructCollection = Backbone.Collection.extend({model:StructModel});
            var DataModel = Backbone.Model.extend(nestify({
                structs:{constructor:StructCollection}
            }));

            // sample DataModel
            var cm0 = new ColModel({name:"CM0"});
            var cm1 = new ColModel({name:"CM1"});
            var cc = new ColCollection([cm0, cm1]);
            var sm = new StructModel({cols:cc, name:"SM"});
            var sc = new StructCollection([sm]);
            var d = new DataModel({structs:sc, name:"DM"});

            env = {
                FooModel: FooModel,
                BarModel: BarModel,
                BazCollection: BazCollection,

                ColModel: ColModel,
                ColCollection: ColCollection,
                StructModel: StructModel,
                StructCollection: StructCollection,
                DataModel: DataModel,

                d: d
            };
        });

        describe('simple set', function(){
            it("should work as normal", function(){
                var f = new env.FooModel();
                f.set("foo", 3);
                assert.strictEqual(3, f.get("foo"), "simple set");
            });
        });

        describe('single nested model', function(){
            it("should have undefined attributes, initially", function(){
                var f = new env.FooModel();
                assert.isUndefined(f.get("bar"));
                assert.isUndefined(f.get("baz"));
            });

        });

        describe('nested model set', function(){
            it("should allow retrieval of nested value(s) using either syntax style", function(){
                var f = new env.FooModel();
                var b = new env.BarModel();
                f.set("bar", b);
                b.set("inky", "dinky");
                assert.strictEqual(f.get(["bar", "inky"]), "dinky");
                assert.strictEqual(f.get("bar|inky"), "dinky");
            });
            it("should allow set using array syntax", function(){
                var f = new env.FooModel();
                var b = new env.BarModel();
                f.set("bar", b);
                f.set(["bar", "baz"], 4);
                assert.strictEqual(b.get("baz"), 4);
            });
            it("should allow set using stringified syntax", function(){
                var f = new env.FooModel();
                var b = new env.BarModel();
                f.set("bar", b);
                f.set("bar|baz", 4);
                assert.strictEqual(b.get("baz"), 4);
            });
            it("should allow set using JSON", function(){
                var f = new env.FooModel();
                var b = new env.BarModel();
                f.set("bar", b);
                f.set({bar: {baz: 4}});
                assert.strictEqual(b.get("baz"), 4);
            });
        });

        /**
         * Test model can be constructed w/ raw JSON, and
         * nested model is of the correct expected type
         */
        describe('nested model dynamic construction', function(){
            it("should be spec'd, then constructed with raw JSON", function(){
                var f = new env.FooModel({bar: {none: 4}});
                assert.strictEqual(f.get("bar|none"), 4);
                assert.instanceOf(f.get("bar"), env.BarModel);
            });
        });

        /**
         * Similar test, for arrays/Collections
         */
        describe('nested collection dynamic construction', function(){
            it("should be spec'd, then constructed with raw JSON", function(){
                var f = new env.FooModel({baz: [{none: 4}, {another:1}]});
                assert.strictEqual(f.get("baz|0|none"), 4);
                assert.strictEqual(f.get("baz|1|another"), 1);
                assert.instanceOf(f.get("baz"), env.BazCollection);
                assert.instanceOf(f.get("baz|0"), env.BarModel);
            });
        });

        describe('nested collection', function(){
            it("should support the get syntax options", function(){
                var f = new env.FooModel();
                var c = new env.BazCollection();
                var b = new env.BarModel();
                var b2 = new env.BarModel();
                f.set("baz", c);
                c.add(b);
                c.add(b2);
                b.set("spicy", "meatball");
                b2.set("tangy", "tofu");
                assert.strictEqual(f.get(["baz", 0, "spicy"]), "meatball");
                assert.strictEqual(f.get("baz|0|spicy"), "meatball");
                assert.strictEqual(f.get(["baz", 1, "tangy"]), "tofu");
            });

            it("should support the set syntax options", function(){
                var f = new env.FooModel();
                var c = new env.BazCollection();
                var b = new env.BarModel();
                var b2 = new env.BarModel();
                f.set("baz", c);
                c.add(b);
                c.add(b2);
                f.set(["baz", 0, "spicy"], "meatball");
                assert.strictEqual(b.get("spicy"), "meatball");
                f.set(["baz", 1, "greasy"], "granny");
                assert.strictEqual(b2.get("greasy"), "granny");
            });

            it("should support stringified set", function(){
                var f = new env.FooModel();
                var c = new env.BazCollection();
                var b = new env.BarModel();
                f.set("baz", c);
                c.add(b);
                f.set("baz|0|spicy", "meatball");
                assert.strictEqual(b.get("spicy"), "meatball");
            });
        });

        /**
         * Note that setting things up front overrides any
         * constructors that may be declared for a nested property.
         */
        describe('deeply-nesting models', function(){
            it("should allow up-front assemblage of nested models, overriding spec", function(){
                var f = new env.FooModel();
                var f2 = new env.FooModel();
                var c = new env.BazCollection();
                var c2 = new env.BazCollection();
                var b = new env.BarModel();
                f.set("baz", c);
                c.add(f2);
                f2.set("baz2", c2);
                c2.add(b);
                b.set("monkey", "butter");
                assert.strictEqual(f.get("baz|0|baz2|0|monkey"), "butter");
            });

            /**
             * If the value being passed in is already a
             * Backbone.Model or Collection instance, preserve 
             * that instance
             */
            it("set should preserve the instance", function(){
                var f = new env.FooModel();
                var c = new env.BazCollection();
                f.set("bar", c);
                assert.instanceOf(f.get("bar"), env.BazCollection);
            });
        });

        /**
         * Test that options are supported. 
         */
        describe('set with options', function(){

            it("silent should suppress events", function(){
                var eventHeard = false;
                var f = new env.FooModel();
                var b = new env.BarModel();
                f.set("bar", b);
                b.on("change:loud", function(){eventHeard = true;});
                b.on("change:quiet", assert.fail);
                f.set({bar: {loud: 4}});
                f.set({bar: {quiet: 8}}, {silent:true});
                assert.isTrue(eventHeard);
            });

            /**
             * similar to previous; counts the number of events on
             * the top-level model TODO
             */
            it("should count events without silent", function(){
                var eventCount = 0;
                var f = new env.FooModel();
                f.on("change", function(){eventCount = eventCount + 1;});
                f.set("bar", new env.BarModel());
                f.set({bar: {loud: 4}});
                assert.strictEqual(eventCount, 1);
            });

            it("should set nested JSON silently", function(){
                var f = new env.FooModel();
                f.on("change", assert.fail);
                f.set({bar: {quiet: 8}}, {silent:true});
            });

            it("should set JSON on nested model silently", function(){
                var f = new env.FooModel();
                var b = new env.BarModel();
                b.set("quiet", 8);
                f.on("change", assert.fail);
                f.set({bar: b}, {silent:true});
            });

            it("should should set JSON on nested collection silently", function(){
                var f = new env.FooModel();
                f.on("change", assert.fail);
                f.set({baz: [{bar: {quiet: 8}}]}, {silent:true});
            });

            it("should set nested collection silently", function(){
                var f = new env.FooModel();
                var c = new env.BazCollection();
                c.add(new env.BarModel({quiet:8}));
                f.on("change", assert.fail);
                f.set({baz: c}, {silent:true});
            });
        });

        describe('nesting an existing model into a model', function(){

            it("should work if pre-constructed", function(){
                var c = new env.BazCollection(new env.BarModel({name:"Tim"}));
                var f = new env.FooModel();
                f.set("baz", c);
                assert.strictEqual(f.get("baz|0|name"), "Tim");
            });

            it("should work if pre-constructed using JSON", function(){
                var c = new env.BazCollection(new env.BarModel({name:"Tim"}));
                var f = new env.FooModel();
                f.set({baz:c});
                assert.strictEqual(f.get("baz|0|name"), "Tim");
            });

            it("should work if modifed after nesting", function(){
                var c = new env.BazCollection();
                var f = new env.FooModel();
                f.set("baz", c);
                c.add(new env.BarModel({name:"Tim"}));
                assert.strictEqual(f.get("baz|0|name"), "Tim");
            });

            it("should work if modified with JSON after nesting", function(){
                var c = new env.BazCollection();
                var f = new env.FooModel();
                f.set({baz:c});
                c.add(new env.BarModel({name:"Tim"}));
                assert.strictEqual(f.get("baz|0|name"), "Tim");
            });

            it("should allow construction with JSON", function(){
                var c = new env.BazCollection(new env.BarModel({name:"Tim"}));
                var f = new env.FooModel({baz:c});
                assert.strictEqual(f.get("baz|0|name"), "Tim");
            });
        });

        describe('constructing a model with a nested collection', function(){

            it("should allow JSON set", function(){
                var f = new env.FooModel();
                var c = new env.BazCollection();
                var b = new env.BarModel();
                f.set("baz", c);
                c.add(b);
                f.set({baz:[{spicy:"meatball"}]});
                assert.strictEqual(b.get("spicy"), "meatball");
            });

            it("should allow JSON set, followed by collection modification", function(){
                var f = new env.FooModel();
                var c = new env.BazCollection();
                f.set("baz", c);
                c.add(new env.BarModel());
                f.set({baz:[{spicy:"meatball"}]});
                assert.strictEqual(f.get("baz|0|spicy"), "meatball");
                assert.instanceOf(f.get("baz|0"), env.BarModel);
            });

            it("should allow modifying the nested collection's model", function(){
                // setup
                var c = new env.BazCollection(new env.BarModel({name:"Tim"}));
                c.add(new env.BarModel({name:"Tim"}));
                var f = new env.FooModel();
                f.set("baz", c);
                assert.strictEqual(f.get("baz|0|name"), "Tim");

                // test
                f.set({baz:[{spicy:"meatball"}]});

                // asserts
                assert.strictEqual(f.get("baz|0|spicy"), "meatball");
                assert.instanceOf(f.get("baz|0"), env.BarModel);
            });

            it("should allow setting of nested collection's models' attributes", function(){
                var f = new env.FooModel();
                var c = new env.BazCollection();
                var b0 = new env.BarModel();
                var b1 = new env.BarModel();
                f.set("baz", c);
                c.add(b0);
                c.add(b1);
                f.set("baz|0|spicy", "meatball");
                assert.strictEqual(b0.get("spicy"), "meatball");
                assert.isUndefined(b1.get("spicy"));
                f.set("baz|1|spicy", "canoli");
                assert.strictEqual(b0.get("spicy"), "meatball");
                assert.strictEqual(b1.get("spicy"), "canoli");
            });
        });


        describe('fine-grained control of nested collection modification by using custom options', function(){

            describe('setting with the "reset" option', function(){
                /**
                 * Simulates the case of a sync: we expect the nested
                 * set to completely replace the contents of any 
                 * nested collections. Hence the {reset:true} option.
                 */
                it("should completely replace the contents of the nested collection", function(){
                    var f = new env.FooModel({baz:[{spicy:"meatball"},
                                                   {tangy:"salsa"}]
                                             });
                    assert.strictEqual(f.get("baz").models.length, 2);
                    f.set({baz:[{hot:"sausage"}]}, {coll:"reset"});
                    assert.strictEqual(f.get("baz").models.length, 1);
                });
            });

            describe('setting with the "set" option', function(){

                /**
                 * Update nested collection with built-in 'set'
                 * function, relying on 'smart' merge, with remove set
                 * to false. Therefore we expect to add the new model
                 * without removing any others.
                 */
                it("should add new models w/o removing others", function(){
                    var f = new env.FooModel({baz:[{spicy:"meatball"},
                                                   {tangy:"salsa"}]
                                             });
                    assert.strictEqual(f.get("baz").models.length, 2);
                    f.set({baz:[{hot:"sausage"}]}, {coll:"set", remove:false});
                    assert.strictEqual(f.get("baz").models.length, 3);
                });
            });

            /**
             * The default and most precise behavior: nested
             * collections are updated with 'at' function based on
             * index.
             */
            describe('setting with the default "at" option', function(){
                it("should update based on index", function(){
                    var f = new env.FooModel({baz:[{spicy:"meatball"},
                                                   {tangy:"salsa"}]
                                             });
                    assert.strictEqual(f.get("baz").models.length, 2);
                    f.set({baz:[{hot:"sausage"}]}, {coll:"at"});
                    assert.strictEqual(f.get("baz").models.length, 2);
                });
            });
        });

        describe('uninitialized nested collection', function(){
            it("should dynamically construct instance of the spec'd model", function(){
                var f = new env.FooModel();
                f.set("baz|2|spicy", "meatball");
                var b = f.get("baz|2");
                assert.instanceOf(b, env.BarModel);
                assert.strictEqual(b.get("spicy"), "meatball");
            });
        });

        describe("nesting non-spec'd attributes", function(){

            /*
             * Nested attributes that are not spec'd as having a Model
             * or Collection constructor can still be gotten and set
             * using the custom nested getter/setter syntax.
             */

            it('should nest primitives', function(){
                var f = new env.FooModel();
                f.set("something|spicy", "meatball");
                assert.strictEqual(f.get("something|spicy"), "meatball");
            });

            it('should nest primitive into an array', function(){
                var f = new env.FooModel();
                f.set("something|2|spicy", "meatball");
                assert.strictEqual(f.get("something|2|spicy"), "meatball");
            });

            it('should make array rather than Collection, obj rather than Model', function(){
                var f = new env.FooModel();
                f.set("something|2|spicy", "meatball");
                assert.notInstanceOf(f.get("something"), Backbone.Collection);
                assert.isArray(f.get("something"));
                assert.notInstanceOf(f.get("something|2"), Backbone.Model);
                assert.isNotArray(f.get("something|2"));
                assert.isObject(f.get("something|2"));
                assert.strictEqual(f.get("something|2|spicy"), "meatball");
                assert.deepEqual(f.get("something"), [, , {spicy:"meatball"}]);
            });

            it('should fill array sparsely if necessary', function(){
                var f = new env.FooModel();
                f.set(["extension", 0], "snuh");
                f.set(["extension", 2], "blammo");
                var b = f.get("extension");
                assert.isArray(b);
                assert.strictEqual(b[0], "snuh");
                assert.strictEqual(b[2], "blammo");
            });

            it('should set objects nested', function(){
                var f = new env.FooModel();
                f.set(["extension", "aak"], "snuh");
                f.set(["extension", "oop"], "blammo");
                var b = f.get("extension");
                assert.isObject(b);
                assert.strictEqual(b.aak, "snuh");
                assert.strictEqual(b.oop, "blammo");
            });

            /**
             * Tests that a nested Model may be unitialized, as
             * long as its constructor is spec'd
             */
            it("should create nested Model, if necessary, of spec'd type", function(){
                var f = new env.FooModel();
                f.set(["bar", "something"], 4);
                var b = f.get("bar");
                assert(b);
                assert.strictEqual(b.get("something"), 4);
                assert(b.constructor === env.BarModel, "nested model is of expected type");
            });
        });

        /**
         * Test 'private' pathToObject function
         */
        describe('pathToObject', function(){
            it('should convert JSON to nested path form', function(){
                var expected = {foo: "bar"};
                assert.deepEqual(nestify.pathToObject("foo", "bar"), expected);
            });

            it('should convert JSON to nested path form', function(){
                var expected = {foo: {bar: "Baz"}};
                assert.deepEqual(nestify.pathToObject(expected), expected);
                assert.deepEqual(nestify.pathToObject(["foo", "bar"], "Baz"), expected);
            });

            it('should convert JSON with array to nested path form', function(){
                var expected = {foo: [{baz: "Goo"}]};
                assert.deepEqual(nestify.pathToObject(expected), expected);
                assert.deepEqual(nestify.pathToObject(["foo", 0, "baz"], "Goo"), expected);
            });

            it('should convert JSON with array to nested path form', function(){
                var expected = {foo: {bar: [, , {baz: "Goo"}]}};
                assert.deepEqual(nestify.pathToObject(expected), expected);
                assert.deepEqual(nestify.pathToObject(["foo", "bar", 2, "baz"], "Goo"), expected);
            });

            it('should convert JSON with null value to nested path form', function(){
                var expected = {foo: {bar: null}};
                assert.deepEqual(nestify.pathToObject(["foo", "bar"], null), expected);
            });

            it('should convert JSON with undefined value to nested path form', function(){
                var un_D_fined;
                var expected = {foo: {bar: un_D_fined}};
                assert.deepEqual(nestify.pathToObject(["foo", "bar"], un_D_fined), expected);
            });

            it('should convert JSON with undefined value to nested path form', function(){
                var un_D_fined = void 0;
                var expected = {foo: [{bar: un_D_fined}]};
                assert.deepEqual(nestify.pathToObject(["foo", 0, "bar"], un_D_fined), expected);
            });
        });

        describe('more complex example', function(){

            it('should nest properly via constructor construction', function(){
                // sample DataModel
                var cm0 = new env.ColModel({name:"CM0"});
                var cm1 = new env.ColModel({name:"CM1"});
                var cc = new env.ColCollection([cm0, cm1]);
                var sm = new env.StructModel({cols:cc, name:"SM"});
                var sc = new env.StructCollection([sm]);
                var d = new env.DataModel({structs:sc, name:"DM"});

                assert.strictEqual(d.get("name"), "DM");
                assert.strictEqual(d.get("structs|0|name"), "SM");
                assert.strictEqual(d.get("structs|0|cols|0|name"), "CM0");
                assert.strictEqual(d.get("structs|0|cols|1|name"), "CM1");
                d.set("structs|0|cols|0|name", "meatball");
                assert.strictEqual(d.get("structs|0|cols|0|name"), "meatball");
                assert.strictEqual(d.get("structs|0|cols|1|name"), "CM1");
                d.set("structs|0|cols|1|name", "canoli");
                assert.strictEqual(d.get("structs|0|cols|0|name"), "meatball");
                assert.strictEqual(d.get("structs|0|cols|1|name"), "canoli");
            });

            it('should nest properly via setter construction', function(){
                // sample DataModel
                var cm0 = new env.ColModel({name:"CM0"});
                var cm1 = new env.ColModel({name:"CM1"});
                var cc = new env.ColCollection();
                var sm = new env.StructModel({name:"SM"});
                var sc = new env.StructCollection();
                var d = new env.DataModel({name:"DM"});

                // construction
                cc.add(cm0);
                cc.add(cm1);
                sm.set("cols", cc);
                sc.add(sm);
                d.set("structs", sc);

                // asserts
                assert.strictEqual(d.get("name"), "DM");
                assert.strictEqual(d.get("structs|0|name"), "SM");
                assert.strictEqual(d.get("structs|0|cols|0|name"), "CM0");
                assert.strictEqual(d.get("structs|0|cols|1|name"), "CM1");
                d.set("structs|0|cols|0|name", "meatball");
                assert.strictEqual(d.get("structs|0|cols|0|name"), "meatball");
                assert.strictEqual(d.get("structs|0|cols|1|name"), "CM1");
                d.set("structs|0|cols|1|name", "canoli");
                assert.strictEqual(d.get("structs|0|cols|0|name"), "meatball");
                assert.strictEqual(d.get("structs|0|cols|1|name"), "canoli");
            });

            it('should nest properly via setter construction, alternate ordering', function(){
                // sample DataModel
                var cm0 = new env.ColModel({name:"CM0"});
                var cm1 = new env.ColModel({name:"CM1"});
                var cc = new env.ColCollection();
                var sm = new env.StructModel({name:"SM"});
                var sc = new env.StructCollection();
                var d = new env.DataModel({name:"DM"});

                // construction
                d.set("structs", sc);
                sc.add(sm);
                sm.set("cols", cc);
                cc.add(cm0);
                cc.add(cm1);

                // asserts
                assert.strictEqual(d.get("name"), "DM");
                assert.strictEqual(d.get("structs|0|name"), "SM");
                assert.strictEqual(d.get("structs|0|cols|0|name"), "CM0");
                assert.strictEqual(d.get("structs|0|cols|1|name"), "CM1");
                d.set("structs|0|cols|0|name", "meatball");
                assert.strictEqual(d.get("structs|0|cols|0|name"), "meatball");
                assert.strictEqual(d.get("structs|0|cols|1|name"), "CM1");
                d.set("structs|0|cols|1|name", "canoli");
                assert.strictEqual(d.get("structs|0|cols|0|name"), "meatball");
                assert.strictEqual(d.get("structs|0|cols|1|name"), "canoli");
            });
        });

        /**
         * Test that the presence of 'attributes' property in 
         * non-Backbone model doesn't break stuff
         */
        describe('attribute named "attribute"', function(){
            it('should not break', function(){
                var b = new env.FooModel({foo:{attributes:{msg:"haha"}}});
                assert.strictEqual(b.get("foo|attributes|msg"), "haha");
            });

            it('should not break; distinct models', function(){
                var b = new env.BarModel({attributes: {msg: "haha"}});
                var f = new env.FooModel({bar:b});
                assert.strictEqual(f.get("bar|attributes|msg"), "haha");
            });
        });

        describe("calling 'set' with Model instance", function(){
            it("should produce duplicate model", function(){
                var m = new env.FooModel();
                var m2 = new env.FooModel({bar: {msg: "haha"}});
                m.set(m2);
                assert.deepEqual(m.toJSON(), m2.toJSON());
            });
        });

        /**
         * Everything is 'existy' except null and undefined.
         */
        describe('test setting values of different existy-ness', function(){
            it("should not set values that aren't existy.", function(){
                var b = new env.BarModel();
                var f = new env.FooModel({bar:b});
                f.set("bar|truDat", true);
                f.set("bar|nope", false);
                f.set("bar|aNull", null);
                f.set("bar|aUndef", env.unDFynd);
                assert.isTrue(b.get("truDat"));
                assert.isFalse(b.get("nope"));
                assert.isNull(b.get("aNull"));
                assert.isUndefined(b.get("aUndef"));
            });
        });

        /**
         * Everything is 'existy' except null and undefined.
         */
        describe('changing based on existy-ness', function(){
            it("should make changes given values that are existy.", function(){
                var b = new env.BarModel({"truDat":false,
                                          "nope":true});
                var f = new env.FooModel({bar:b});
                f.set("bar|truDat", true);
                f.set("bar|nope", false);
                assert.isTrue(b.get("truDat"));
                assert.isFalse(b.get("nope"));
            });
            /*TODO?
            it("should not make change given values that are not existy.", function(){
                var b = new env.BarModel({"truDat":false,
                                          "nope":true});
                var f = new env.FooModel({bar:b});
                f.set("bar|truDat", null);
                f.set("bar|nope", env.unDFynd);
                assert.isFalse(b.get("truDat"));
                assert.isTrue(b.get("nope"));
            });
             */
        });

        describe('unset', function(){

            it('should unset in a nested model', function(){
                var f = new env.FooModel({bar: {none: 4}});
                assert.strictEqual(f.get("bar|none"), 4);
                f.unset("bar|none");
                assert.isUndefined(f.get("bar|none"));
            });

            it('should unset a non-nested attribute', function(){
                var f = new env.FooModel({blargh: 4});
                assert.strictEqual(f.get("blargh"), 4);
                f.unset("blargh");
                assert.isUndefined(f.get("blargh"));
            });

            it('should unset silently', function(){
                var f = new env.FooModel();
                var b = new env.BarModel();
                f.set({bar: b});
                b.set({quiet: 8});
                f.on("change", assert.fail);
                b.on("change", assert.fail);
                f.unset("bar|quiet", {silent:true});
            });

            it('should unset with a Collection', function(){
                var f = new env.FooModel();
                var c = new env.BazCollection();
                var b = new env.BarModel();
                f.set("baz", c);
                c.add(b);
                f.set("baz|0|spicy", "meatball");
                assert.strictEqual(b.get("spicy"), "meatball");
                f.unset("baz|0|spicy");
                assert.isUndefined(b.get("spicy"));
            });

            it('should unset a Collection', function(){
                var f = new env.FooModel();
                var c = new env.BazCollection();
                var b = new env.BarModel();
                f.set("baz", c);
                c.add(b);
                f.set("baz|0|spicy", "meatball");
                assert.strictEqual(b.get("spicy"), "meatball");
                f.unset("baz");
                assert.isUndefined(f.get("baz"));
            });
        });

        describe('clear', function(){
            it("should clear all nested", function(){
                var f = new env.FooModel();
                var c = new env.BazCollection();
                var b = new env.BarModel();
                f.set("baz", c);
                c.add(b);
                f.set("baz|0|spicy", "meatball");
                assert.strictEqual(b.get("spicy"), "meatball");
                f.clear();
                assert(_.isEmpty(f.attributes));
            });
        });

    });

}));